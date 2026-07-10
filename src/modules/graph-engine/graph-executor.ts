import type { AgentJson, AgentNode, ExecutionContext, NodeResult } from '../../types/index.js'
import { nodeRegistry } from './node-handler.js'
import { validateDag, topologicalSort } from './dag-validator.js'
import { validateAgentStructure } from './agent-parser.js'
import { checkpointService } from '../state-manager/checkpoint.service.js'
import { databaseService } from '../database/database.service.js'

export class GraphExecutor {
  async execute(
    agentInput: unknown,
    executionId: string,
    trigger: string,
    inputVars: Record<string, unknown> = {},
  ): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> {
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

    const executionOrder = topologicalSort(agent.nodes, agent.edges)
    const nodeMap = new Map(agent.nodes.map((n) => [n.id, n]))

    await this.createLog(executionId, 'INFO', `Execution started (trigger: ${trigger})`)

    let variables: Record<string, unknown> = { ...inputVars }
    let currentNodeIndex = 0

    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId)
      if (!node) continue

      await this.createLog(executionId, 'INFO', `Node started: ${node.label || node.type}`, node.id, node.type)

      const handler = nodeRegistry.get(node.type)
      if (!handler) {
        const err = `No handler for node type: ${node.type}`
        await this.createLog(executionId, 'ERROR', err, node.id, node.type)
        await this.failExecution(executionId, err)
        return { success: false, error: err }
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
        checkpoints: [],
        config: agent.settings,
      }

      let result: NodeResult
      try {
        result = await handler.execute(context)
      } catch (err: any) {
        const errorMsg = err.message || 'Unknown error'
        await this.createLog(executionId, 'ERROR', `Node failed: ${node.label || node.type} - ${errorMsg}`, node.id, node.type)

        if (agent.settings.errorHandling === 'continue') {
          await this.createLog(executionId, 'WARN', `Continuing despite failure (errorHandling: continue)`, node.id, node.type)
          continue
        }
        if (agent.settings.errorHandling === 'rollback') {
          await this.rollback(agent, executionOrder, nodeMap, currentNodeIndex)
        }
        await this.failExecution(executionId, errorMsg)
        return { success: false, error: errorMsg }
      }

      if (result.output) {
        variables = { ...variables, ...result.output }
      }

      await checkpointService.save({
        executionId,
        nodeId: node.id,
        nodeType: node.type,
        state: { variables, lastResult: result },
        variables,
      })

      if (!result.success) {
        await this.createLog(executionId, 'ERROR', `Node returned failure: ${node.label || node.type}`, node.id, node.type)
        if (agent.settings.errorHandling !== 'continue') {
          await this.failExecution(executionId, result.error || 'Node returned failure')
          return { success: false, error: result.error || 'Node returned failure' }
        }
        await this.createLog(executionId, 'WARN', `Continuing despite failure (errorHandling: continue)`, node.id, node.type)
        currentNodeIndex++
        continue
      }

      await this.createLog(executionId, 'INFO', `Node completed: ${node.label || node.type}`, node.id, node.type)

      if (result.pauseForApproval) {
        await this.updateExecutionStatus(executionId, 'WAITING_APPROVAL')
        await this.createLog(executionId, 'INFO', `Execution paused: waiting for approval`, node.id, node.type)
        return { success: true, output: result.output }
      }

      currentNodeIndex++
    }

    await this.updateExecutionStatus(executionId, 'COMPLETED', variables)
    await this.createLog(executionId, 'INFO', `Execution completed successfully`)
    return { success: true, output: variables }
  }

  private async rollback(
    agent: AgentJson,
    executionOrder: string[],
    nodeMap: Map<string, AgentNode>,
    fromIndex: number,
  ) {
    for (let i = fromIndex; i >= 0; i--) {
      const nodeId = executionOrder[i]
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
