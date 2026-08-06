import { FastifyInstance } from 'fastify'
import { databaseService } from '../../modules/database/database.service.js'
import { mcpRuntimeService } from '../../modules/mcp-runtime/mcp-runtime.service.js'
import type { McpRequest, McpResponse, McpToolDefinition, McpToolResult, McpToolContent } from '../../types/mcp.js'

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown): McpResponse {
  return { jsonrpc: '2.0', id: id || 0, error: { code, message, data } }
}

function jsonRpcSuccess(id: string | number | null, result: unknown): McpResponse {
  return { jsonrpc: '2.0', id: id || 0, result }
}

export async function mcpPublicRoutes(app: FastifyInstance) {
  app.post('/api/mcp/v1', {
    handler: async (request, reply) => {
      const body = request.body as McpRequest

      if (body.jsonrpc && body.jsonrpc !== '2.0') {
        return jsonRpcError(null, -32600, 'Invalid Request: jsonrpc must be "2.0"')
      }

      const id = body.id ?? null

      // Parse auth header
      const authHeader = request.headers['authorization'] as string || ''
      const apiKey = (request.headers['x-api-key'] as string) || ''
      const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

      if (!apiKey && !bearerToken) {
        return jsonRpcError(id, -32001, 'Authentication required. Provide x-api-key header or Bearer token.')
      }

      switch (body.method) {
        case 'server/discover': {
          return jsonRpcSuccess(id, {
            protocolVersion: '2025-03-26',
            serverInfo: {
              name: 'WEHA AI Box MCP',
              version: '1.0.0',
              description: 'WEHA AI Box MCP protocol gateway',
            },
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: false, listChanged: false },
            },
          })
        }

        case 'tools/list': {
          try {
            const db = databaseService.getClient()
            const agentType = (body.params?.agentType as string) || ''
            const toolCode = (body.params?.code as string) || ''

            const where: any = { status: 'ACTIVE' }
            if (toolCode) where.code = toolCode

            const tools = await db.mcpTool.findMany({ where, include: { server: true } })

            let filteredTools = tools
            if (agentType) {
              const permissions = await db.mcpAgentPermission.findMany({
                where: { agent: { type: agentType } },
                select: { toolId: true },
              })
              const allowedIds = new Set(permissions.map(p => p.toolId))
              filteredTools = tools.filter(t => allowedIds.has(t.id))
            }

            const definitions: McpToolDefinition[] = filteredTools.map(t => ({
              name: t.code || t.name,
              description: t.description || '',
              inputSchema: (t.inputSchema || t.schema || { type: 'object', properties: {} }) as any,
              outputSchema: t.outputSchema as any || undefined,
            }))

            return jsonRpcSuccess(id, { tools: definitions })
          } catch (err: any) {
            return jsonRpcError(id, -32000, `Failed to list tools: ${err.message}`)
          }
        }

        case 'tools/call': {
          try {
            const toolName = body.params?.name as string
            const args = (body.params?.arguments || {}) as Record<string, unknown>

            if (!toolName) {
              return jsonRpcError(id, -32602, 'Missing parameter: name')
            }

            const db = databaseService.getClient()
            const tool = await db.mcpTool.findFirst({
              where: { OR: [{ code: toolName }, { name: toolName }], status: 'ACTIVE' },
              include: { server: true },
            })

            if (!tool) {
              return jsonRpcError(id, -32002, `Tool not found: ${toolName}`)
            }

            let result: any

            // Try executing via external MCP server first
            if (tool.serverId) {
              try {
                result = await mcpRuntimeService.executeTool(tool.serverId, tool.name, args)
              } catch (err: any) {
                // Fall through to local execution if possible
                result = { error: err.message }
              }
            } else {
              result = { message: `Tool ${toolName} has no execution endpoint configured` }
            }

            const content: McpToolContent[] = [{
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            }]

            // Record execution
            await db.toolExecution.create({
              data: {
                toolId: tool.id,
                status: 'COMPLETED',
                input: args,
                output: result,
              },
            })

            const toolResult: McpToolResult = { content }
            return jsonRpcSuccess(id, toolResult)
          } catch (err: any) {
            return jsonRpcError(id, -32000, `Tool execution failed: ${err.message}`)
          }
        }

        case 'agents/sync': {
          try {
            const db = databaseService.getClient()
            const agents = await db.agent.findMany({
              where: { isActive: true, status: 'ACTIVE' },
            })

            const mappedAgents = agents.map(agent => {
              const definition = agent.definition as any || {}
              return {
                ...definition,
                checksum: agent.checksum,
                signature: agent.signature,
                agent: {
                  ...definition.agent,
                  id: agent.agentId,
                  name: agent.name,
                  version: agent.version,
                },
              }
            })

            return jsonRpcSuccess(id, { agents: mappedAgents })
          } catch (err: any) {
            return jsonRpcError(id, -32000, `Failed to sync agents: ${err.message}`)
          }
        }

        case 'resources/list': {
          return jsonRpcSuccess(id, { resources: [] })
        }

        case 'resources/read': {
          return jsonRpcError(id, -32601, 'Method not supported: resources/read')
        }

        default:
          return jsonRpcError(id, -32601, `Method not found: ${body.method}`)
      }
    },
  })
}
