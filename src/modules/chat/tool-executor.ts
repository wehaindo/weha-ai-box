import { databaseService } from '../database/database.service.js'
import { mcpRuntimeService } from '../mcp-runtime/mcp-runtime.service.js'
import { localToolRegistry } from '../mcp-runtime/local-tool-registry.js'
import { erpAuthService } from '../erp-connector/erp-auth.service.js'
import { formatUpstreamError } from '../erp-connector/erp-error.js'
import { listAgentsCatalog, RUN_AGENT_FUNCTION, LIST_AGENTS_FUNCTION } from './tools.js'
import type { ChatTool } from './tools.js'

const MAX_RESULT_CHARS = 8000

function textify(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function truncate(text: string): string {
  if (text.length <= MAX_RESULT_CHARS) return text
  return `${text.slice(0, MAX_RESULT_CHARS)}\n...[truncated]`
}

export async function executeToolByCode(code: string, params: Record<string, unknown>): Promise<unknown> {
  const db = databaseService.getClient()
  const tool = await db.mcpTool.findFirst({
    where: { OR: [{ code }, { name: code }], status: 'ACTIVE' },
    include: { server: true },
  })

  if (!tool) {
    throw new Error(`Tool not found: ${code}`)
  }

  let result: unknown

  if (tool.serverId && (tool.server as any)?.status === 'CONNECTED') {
    result = await mcpRuntimeService.executeTool(tool.serverId, tool.name, params || {})
  } else if (localToolRegistry.has(code)) {
    result = await mcpRuntimeService.executeLocalTool(code, params || {})
  } else if (erpAuthService.isConfigured()) {
    const serverUrl = erpAuthService.getServerUrl()
    const headers = erpAuthService.getHeaders()
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/device/v1/ai-box/mcp-tools/execute`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, params: params || {} }),
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) {
      result = (await res.json()).data
    } else {
      const errBody = await res.text().catch(() => '')
      throw new Error(formatUpstreamError(res.status, errBody))
    }
  } else {
    result = { message: `Tool ${code} is available but no local handler, MCP server, or ERP connection configured` }
  }

  try {
    await db.toolExecution.create({
      data: {
        toolId: tool.id,
        status: 'COMPLETED',
        input: (params || {}) as any,
        output: result as any,
      },
    })
  } catch {
    // non-critical
  }

  return result
}

export async function listAgentsForTool(): Promise<unknown> {
  const agents = await listAgentsCatalog()
  return {
    agents: agents.map((a) => ({
      agentId: a.agentId,
      name: a.name,
      type: a.type,
      version: a.version,
      description: a.description,
      prompt: a.prompt,
    })),
    agentCount: agents.length,
  }
}

async function runAgent(agentId: string, input: Record<string, unknown>): Promise<unknown> {
  const db = databaseService.getClient()
  const agent = await db.agent.findUnique({ where: { agentId } })
  if (!agent) throw new Error(`Agent not found: ${agentId}`)
  if (!agent.definition) throw new Error(`Agent ${agentId} has no definition`)

  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const execution = await db.execution.create({
    data: {
      executionId,
      agentId,
      status: 'RUNNING',
      trigger: 'MANUAL',
      source: 'CHAT',
      input: (input || {}) as any,
    },
  })

  const graphExecutor = (await import('../graph-engine/index.js')).graphExecutor
  graphExecutor.execute(agent.definition, executionId, 'MANUAL', input || {}).catch((err: Error) => {
    console.error(`Chat agent execution ${executionId} error:`, err)
  })

  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500))
    const current = await db.execution.findUnique({ where: { executionId } })
    if (!current) break
    const status = current.status
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
      return {
        executionId,
        status,
        duration: current.duration,
        tokenUsage: current.tokenUsage,
        output: current.output,
        error: current.error,
        startedAt: current.startedAt,
        completedAt: current.completedAt,
      }
    }
  }

  return {
    executionId,
    status: 'TIMEOUT',
    message: 'Agent execution still running; check the Executions page for status.',
  }
}

export async function executeChatTool(tool: ChatTool, args: Record<string, unknown>): Promise<string> {
  try {
    let result: unknown

    switch (tool.kind) {
      case 'mcp':
        result = await executeToolByCode(tool.code, args || {})
        break
      case 'local':
        result = await mcpRuntimeService.executeLocalTool(tool.code, args || {})
        break
      case 'list_agents':
        result = await listAgentsForTool()
        break
      case 'agent': {
        const agentId = (args as any).agentId as string
        const input = ((args as any).input as Record<string, unknown>) || {}
        result = await runAgent(agentId, input)
        break
      }
      default:
        result = { error: `Unknown tool kind: ${tool.kind}` }
    }

    return truncate(textify(result))
  } catch (err: any) {
    return truncate(`ERROR: ${err.message}`)
  }
}
