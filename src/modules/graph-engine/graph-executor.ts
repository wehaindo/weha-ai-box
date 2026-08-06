import type { AgentJson, AgentNode, AgentEdge, ExecutionContext, NodeResult, ExecutionLogEntry } from '../../types/index.js'
import { nodeRegistry } from './node-handler.js'
import { validateDag } from './dag-validator.js'
import { validateAgentStructure } from './agent-parser.js'
import { checkpointService } from '../state-manager/checkpoint.service.js'
import { databaseService } from '../database/database.service.js'

export class GraphExecutor {
  async execute(
    agentInput: unknown,
    executionId: string,
    trigger: string,
    inputVars: Record<string, unknown> = {},
  ): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string; executionLog?: ExecutionLogEntry[] }> {
    const execLog: ExecutionLogEntry[] = []
    const parseResult = validateAgentStructure(agentInput)
    if (!parseResult.success) {
      const err = `Invalid agent: ${parseResult.errors.join('; ')}`
      await this.createLog(executionId, 'ERROR', err)
      await this.failExecution(executionId, err)
      return { success: false, error: err }
    }

    const agent = parseResult.agent

    const validationErrors = validateDag(agent.nodes, agent.edges)
    if (validationErrors.length > 0) {
      const err = `Invalid graph: ${validationErrors.map((e) => e.message).join('; ')}`
      await this.createLog(executionId, 'ERROR', err)
      await this.failExecution(executionId, err)
      return { success: false, error: err }
    }

    const nodeMap = new Map(agent.nodes.map((n) => [n.id, n]))
    const edgeMap = this.buildEdgeMap(agent.edges)

    await this.createLog(executionId, 'INFO', `Execution started (trigger: ${trigger})`)

    let variables: Record<string, unknown> = { ...inputVars }
    const visited = new Set<string>()

    const startNode = agent.nodes.find((n) => n.type === 'start')
    if (!startNode) {
      const err = 'No start node found'
      await this.createLog(executionId, 'ERROR', err)
      await this.failExecution(executionId, err)
      return { success: false, error: err }
    }

    const queue: { nodeId: string; depth: number }[] = [{ nodeId: startNode.id, depth: 0 }]
    let maxIterations = (agent.settings as any)?.maxIterations || 100
    let iterations = 0
    let totalTokenUsage = 0

    while (queue.length > 0 && iterations < maxIterations) {
      const current = queue.shift()!
      const node = nodeMap.get(current.nodeId)
      if (!node) continue

      if (visited.has(node.id) && node.type !== 'loop') continue

      const nodeStartTime = Date.now()
      const inputSnapshot = { ...variables }

      await this.createLog(executionId, 'INFO', `Node started: ${node.label || node.type}`, node.id, node.type)

      const handler = nodeRegistry.get(node.type)
      if (!handler) {
        const err = `No handler for node type: ${node.type}`
        execLog.push({
          nodeId: node.id, nodeType: node.type, label: node.label || node.type,
          duration: Date.now() - nodeStartTime, status: 'failed', error: err, input: inputSnapshot,
        })
        await this.createLog(executionId, 'ERROR', err, node.id, node.type)
        await this.failExecution(executionId, err)
        await this.saveExecutionLog(executionId, execLog, variables, totalTokenUsage)
        return { success: false, error: err, executionLog: execLog }
      }

      const context: ExecutionContext = {
        executionId,
        agentId: agent.agent.id,
        trigger: trigger as any,
        input: inputVars,
        variables,
        nodeId: node.id,
        node,
        edges: agent.edges,
        edgeMap,
        checkpoints: [],
        config: agent.settings,
      }

      let result: NodeResult
      try {
        result = await handler.execute(context)
      } catch (err: any) {
        const errorMsg = err.message || 'Unknown error'
        execLog.push({
          nodeId: node.id, nodeType: node.type, label: node.label || node.type,
          duration: Date.now() - nodeStartTime, status: 'failed', error: errorMsg, input: inputSnapshot,
        })
        await this.createLog(executionId, 'ERROR', `Node failed: ${node.label || node.type} - ${errorMsg}`, node.id, node.type)

        if (agent.settings.errorHandling === 'continue') {
          await this.createLog(executionId, 'WARN', `Continuing despite failure (errorHandling: continue)`, node.id, node.type)
          visited.add(node.id)
          iterations++
          continue
        }
        if (agent.settings.errorHandling === 'rollback') {
          await this.rollback(agent, nodeMap, current.nodeId)
        }
        await this.failExecution(executionId, errorMsg)
        await this.saveExecutionLog(executionId, execLog, variables, totalTokenUsage)
        return { success: false, error: errorMsg, executionLog: execLog }
      }

      if (result.output) {
        variables = { ...variables, ...result.output }
      }

      if (result.tokenUsage) {
        totalTokenUsage += result.tokenUsage
      }

      await checkpointService.save({
        executionId,
        nodeId: node.id,
        nodeType: node.type,
        state: { variables, lastResult: result },
        variables,
      })

      if (!result.success) {
        execLog.push({
          nodeId: node.id, nodeType: node.type, label: node.label || node.type,
          duration: Date.now() - nodeStartTime, status: 'failed', error: result.error,
          input: inputSnapshot, output: result.output, tokenUsage: result.tokenUsage,
        })
        await this.createLog(executionId, 'ERROR', `Node returned failure: ${node.label || node.type}`, node.id, node.type)
        if (agent.settings.errorHandling !== 'continue') {
          await this.failExecution(executionId, result.error || 'Node returned failure')
          await this.saveExecutionLog(executionId, execLog, variables, totalTokenUsage)
          return { success: false, error: result.error || 'Node returned failure', executionLog: execLog }
        }
        await this.createLog(executionId, 'WARN', `Continuing despite failure (errorHandling: continue)`, node.id, node.type)
        visited.add(node.id)
        iterations++
        continue
      }

      const duration = Date.now() - nodeStartTime
      let status: ExecutionLogEntry['status'] = 'success'
      if (result.pauseForApproval) status = 'pending_approval'
      if (result.pauseForInput) status = 'waiting_input'

      execLog.push({
        nodeId: node.id, nodeType: node.type, label: node.label || node.type,
        duration, status, input: inputSnapshot, output: result.output,
        error: result.error, tokenUsage: result.tokenUsage,
      })

      await this.createLog(executionId, 'INFO', `Node completed: ${node.label || node.type}`, node.id, node.type)

      if (result.pauseForApproval || result.pauseForInput) {
        const pauseStatus = result.pauseForApproval ? 'WAITING_APPROVAL' : 'WAITING_INPUT'
        await this.updateExecutionStatus(executionId, pauseStatus)
        await this.createLog(executionId, 'INFO', `Execution paused: ${pauseStatus}`, node.id, node.type)
        await this.saveExecutionLog(executionId, execLog, variables, totalTokenUsage, false)
        return { success: true, output: result.output, executionLog: execLog }
      }

      const nextNodeIds = this.getNextNodes(node, edgeMap, variables, result)
      for (const nextId of nextNodeIds) {
        queue.push({ nodeId: nextId, depth: current.depth + 1 })
      }

      if (node.type === 'loop' && result.loopContinue) {
        queue.push({ nodeId: node.id, depth: current.depth + 1 })
      } else {
        visited.add(node.id)
      }

      iterations++
    }

    if (iterations >= maxIterations) {
      const err = `Execution exceeded max iterations (${maxIterations})`
      await this.createLog(executionId, 'ERROR', err)
      await this.failExecution(executionId, err)
      await this.saveExecutionLog(executionId, execLog, variables, totalTokenUsage)
      return { success: false, error: err, executionLog: execLog }
    }

    await this.updateExecutionStatus(executionId, 'COMPLETED', { executionLog: execLog, context: variables })
    await this.createLog(executionId, 'INFO', `Execution completed successfully`)
    await this.saveExecutionLog(executionId, execLog, variables, totalTokenUsage)
    return { success: true, output: { executionLog: execLog, context: variables }, executionLog: execLog }
  }

  private async saveExecutionLog(
    executionId: string,
    execLog: ExecutionLogEntry[],
    context: Record<string, unknown>,
    totalTokenUsage: number,
    completed = true,
  ) {
    try {
      const db = databaseService.getClient()
      const tokenUsage = totalTokenUsage || execLog.reduce((sum, e) => sum + (e.tokenUsage || 0), 0)
      await db.execution.update({
        where: { executionId },
        data: {
          output: { executionLog: execLog, context },
          tokenUsage,
          ...(completed ? { completedAt: new Date() } : {}),
        },
      })
    } catch {
      // non-critical
    }
  }

  private buildEdgeMap(edges: AgentEdge[]): Map<string, AgentEdge[]> {
    const edgeMap = new Map<string, AgentEdge[]>()
    for (const edge of edges) {
      const existing = edgeMap.get(edge.source) || []
      existing.push(edge)
      edgeMap.set(edge.source, existing)
    }
    return edgeMap
  }

  private getNextNodes(
    node: AgentNode,
    edgeMap: Map<string, AgentEdge[]>,
    variables: Record<string, unknown>,
    result: NodeResult,
  ): string[] {
    const outEdges = edgeMap.get(node.id) || []

    if (result.nextNodeId) return [result.nextNodeId]

    switch (node.type) {
      case 'condition': {
        const conditionValue = result.routingValue
        const trueEdge = outEdges.find((e) => e.label === 'true' || e.label === 'True')
        const falseEdge = outEdges.find((e) => e.label === 'false' || e.label === 'False')
        const defaultEdge = outEdges.find((e) => !e.label)

        if (conditionValue === true || conditionValue === 'true') {
          return trueEdge ? [trueEdge.target] : defaultEdge ? [defaultEdge.target] : []
        }
        return falseEdge ? [falseEdge.target] : defaultEdge ? [defaultEdge.target] : []
      }

      case 'switch': {
        const switchValue = result.routingValue
        const matchingEdge = outEdges.find((e) => e.label === String(switchValue))
        const defaultEdge = outEdges.find((e) => e.label === 'default')
        return matchingEdge ? [matchingEdge.target] : defaultEdge ? [defaultEdge.target] : []
      }

      case 'loop': {
        if (result.loopContinue) {
          const bodyEdge = outEdges.find((e) => e.label === 'body')
          return bodyEdge ? [bodyEdge.target] : []
        }
        const exitEdge = outEdges.find((e) => e.label === 'exit')
        return exitEdge ? [exitEdge.target] : outEdges.length > 0 ? [outEdges[0].target] : []
      }

      case 'parallel': {
        return outEdges.map((e) => e.target)
      }

      default:
        return outEdges.map((e) => e.target)
    }
  }

  private async rollback(
    agent: AgentJson,
    nodeMap: Map<string, AgentNode>,
    fromNodeId: string,
  ) {
    const edgeMap = this.buildEdgeMap(agent.edges)
    const visited = new Set<string>()
    const rollbackQueue: string[] = [fromNodeId]

    const rollbackNodes: string[] = []
    while (rollbackQueue.length > 0) {
      const nodeId = rollbackQueue.shift()!
      if (visited.has(nodeId)) continue
      visited.add(nodeId)
      rollbackNodes.unshift(nodeId)

      for (const edge of agent.edges) {
        if (edge.target === nodeId) {
          rollbackQueue.push(edge.source)
        }
      }
    }

    for (const nodeId of rollbackNodes) {
      const node = nodeMap.get(nodeId)
      if (!node) continue

      const handler = nodeRegistry.get(node.type)
      if (handler?.rollback) {
        try {
          await handler.rollback({
            executionId: '',
            agentId: agent.agent.id,
            trigger: 'MANUAL',
            input: {},
            variables: {},
            nodeId: node.id,
            node,
            edges: agent.edges,
            edgeMap,
            checkpoints: [],
            config: agent.settings,
          })
        } catch {
          // continue rolling back
        }
      }
    }
  }

  private async createLog(executionId: string, level: string, message: string, nodeId?: string, nodeType?: string) {
    try {
      const db = databaseService.getClient()
      await db.executionLog.create({
        data: {
          executionId,
          nodeId: nodeId || null,
          nodeType: nodeType || null,
          level: level as any,
          message,
        },
      })
    } catch {
      // non-critical
    }
  }

  private async failExecution(executionId: string, error: string) {
    try {
      const db = databaseService.getClient()
      await db.execution.update({
        where: { executionId },
        data: {
          status: 'FAILED',
          error,
          completedAt: new Date(),
        },
      })
    } catch {
      // non-critical
    }
  }

  private async updateExecutionStatus(executionId: string, status: string, output?: Record<string, unknown>) {
    try {
      const db = databaseService.getClient()
      await db.execution.update({
        where: { executionId },
        data: {
          status: status as any,
          ...(output ? { output } : {}),
          ...(status === 'COMPLETED' || status === 'FAILED' ? { completedAt: new Date() } : {}),
        },
      })
    } catch {
      // non-critical
    }
  }

  async pause(executionId: string) {
    await this.updateExecutionStatus(executionId, 'PAUSED')
  }

  async resume(executionId: string): Promise<boolean> {
    try {
      const db = databaseService.getClient()
      const checkpoint = await db.checkpoint.findFirst({
        where: { executionId },
        orderBy: { createdAt: 'desc' },
      })

      if (!checkpoint) return false

      await this.updateExecutionStatus(executionId, 'RUNNING')
      return true
    } catch {
      return false
    }
  }

  async cancel(executionId: string) {
    await this.updateExecutionStatus(executionId, 'CANCELLED')
  }
}

export const graphExecutor = new GraphExecutor()
