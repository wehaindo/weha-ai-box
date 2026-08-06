import { databaseService } from '../database/database.service.js'
import { localToolRegistry } from '../mcp-runtime/local-tool-registry.js'
import type { FunctionTool, FunctionToolParameter } from '../llm/llm-provider.service.js'

export type ChatToolKind = 'mcp' | 'local' | 'agent' | 'list_agents'

export interface ChatTool {
  functionName: string
  code: string
  kind: ChatToolKind
  name: string
  description: string
  schema: FunctionToolParameter
}

export const LIST_AGENTS_FUNCTION = 'list_agents'
export const RUN_AGENT_FUNCTION = 'run_agent'

function sanitizeFunctionName(name: string): string {
  let clean = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
  if (!clean) clean = 'tool'
  if (/^[0-9]/.test(clean)) clean = `t_${clean}`
  return clean
}

function defaultSchema(description: string): FunctionToolParameter {
  return {
    type: 'object',
    description,
    properties: {},
  }
}

function toFunctionTool(tool: ChatTool): FunctionTool {
  return {
    type: 'function',
    function: {
      name: tool.functionName,
      description: tool.description,
      parameters: tool.schema,
    },
  }
}

async function resolveMcpTools(): Promise<ChatTool[]> {
  const db = databaseService.getClient()
  const tools = await db.mcpTool.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
  })

  return tools.map((t) => {
    const rawSchema = (t.inputSchema || t.schema || {}) as unknown as FunctionToolParameter | null
    let schema = defaultSchema(t.description || t.name)
    if (rawSchema && typeof rawSchema === 'object') {
      const properties: Record<string, FunctionToolParameter> = {}
      const required: string[] = []

      if (rawSchema.properties && typeof rawSchema.properties === 'object') {
        for (const [key, prop] of Object.entries(rawSchema.properties as Record<string, any>)) {
          properties[key] = {
            type: prop?.type || 'string',
            description: prop?.description,
            enum: prop?.enum,
            default: prop?.default,
          }
          if (prop?.required) required.push(key)
        }
      }

      schema = {
        type: 'object',
        description: t.description || t.name,
        properties,
        ...(required.length > 0 ? { required } : {}),
      }
    }

    return {
      functionName: sanitizeFunctionName(t.code || t.name),
      code: t.code || t.name,
      kind: 'mcp',
      name: t.name,
      description: t.description || t.name,
      schema,
    }
  })
}

function resolveLocalTools(): ChatTool[] {
  return localToolRegistry.getAll().map(({ code, handler }) => ({
    functionName: sanitizeFunctionName(code),
    code,
    kind: 'local',
    name: handler.name,
    description: handler.description,
    schema: defaultSchema(handler.description),
  }))
}

export async function getChatTools(): Promise<ChatTool[]> {
  const mcpTools = await resolveMcpTools()
  const localTools = resolveLocalTools()

  const agentTool: ChatTool = {
    functionName: RUN_AGENT_FUNCTION,
    code: RUN_AGENT_FUNCTION,
    kind: 'agent',
    name: 'Run Agent',
    description:
      'Execute a deployed agent (business workflow) by its agentId and return its final output. The agent runs as a graph of business steps (ERP queries, actions, notifications, etc). Call list_agents first to see available agents. Args: agentId (string, required), input (object, optional variable values passed to the agent).',
    schema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'The agentId of the agent to run' },
        input: { type: 'object', description: 'Optional input variables for the agent' },
      },
      required: ['agentId'],
    },
  }

  const listTool: ChatTool = {
    functionName: LIST_AGENTS_FUNCTION,
    code: LIST_AGENTS_FUNCTION,
    kind: 'list_agents',
    name: 'List Agents',
    description:
      'List all available agents with their agentId, name, type, description and version. Use this before running an agent to find the right agentId.',
    schema: defaultSchema('List available agents'),
  }

  return [...localTools, ...mcpTools, agentTool, listTool]
}

export function toFunctionTools(tools: ChatTool[]): FunctionTool[] {
  return tools.map(toFunctionTool)
}

export function findChatTool(tools: ChatTool[], functionName: string): ChatTool | undefined {
  return tools.find((t) => t.functionName === functionName)
}

export function summarizeAgentsForPrompt(agents: { agentId: string; name: string; type: string | null; description: string | null; version: number }[]): string {
  if (agents.length === 0) return 'No agents are currently available.'
  return agents
    .map(
      (a) =>
        `- agentId: ${a.agentId} | name: ${a.name} | type: ${a.type || 'unknown'} | v${a.version}${a.description ? ` | description: ${a.description}` : ''}`,
    )
    .join('\n')
}

export function summarizeToolsForPrompt(tools: ChatTool[]): string {
  const notable = tools.filter((t) => t.kind === 'mcp' || t.kind === 'local')
  if (notable.length === 0) return 'No MCP or local tools are currently available.'
  return notable
    .map(
      (t) =>
        `- code: ${t.code} | name: ${t.name}${t.description ? ` | description: ${t.description}` : ''}`,
    )
    .join('\n')
}

export async function listAgentsCatalog(): Promise<{ agentId: string; name: string; type: string | null; description: string | null; version: number; prompt: string | null }[]> {
  const db = databaseService.getClient()
  const agents = await db.agent.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      agentId: true,
      name: true,
      type: true,
      description: true,
      version: true,
      prompt: true,
    },
  })
  return agents
}
