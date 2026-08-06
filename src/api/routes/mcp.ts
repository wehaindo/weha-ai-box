import { FastifyInstance } from 'fastify'
import { mcpRuntimeService } from '../../modules/mcp-runtime/mcp-runtime.service.js'
import { localToolRegistry } from '../../modules/mcp-runtime/local-tool-registry.js'
import { databaseService } from '../../modules/database/database.service.js'
import { erpAuthService } from '../../modules/erp-connector/erp-auth.service.js'
import { formatUpstreamError } from '../../modules/erp-connector/erp-error.js'

export async function mcpRoutes(app: FastifyInstance) {
  app.get('/api/mcp/servers', {
    handler: async () => {
      const db = databaseService.getClient()
      const servers = await db.mcpServer.findMany({
        include: { _count: { select: { tools: true } } },
      })
      return { data: servers }
    },
  })

  app.post('/api/mcp/servers', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'url'],
        properties: {
          name: { type: 'string' },
          url: { type: 'string' },
          apiKey: { type: 'string' },
          description: { type: 'string' },
          config: { type: 'object' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as any
      const id = await mcpRuntimeService.registerServer({
        name: body.name,
        url: body.url,
        apiKey: body.apiKey,
        description: body.description,
        config: body.config,
      })
      reply.code(201)
      return { data: { id } }
    },
  })

  app.post('/api/mcp/servers/:id/discover', {
    handler: async (request, reply) => {
      const { id } = request.params as any
      try {
        const tools = await mcpRuntimeService.discoverTools(id)
        return { success: true, tools }
      } catch (err: any) {
        reply.code(502)
        return { error: err.message }
      }
    },
  })

  app.post('/api/mcp/servers/:id/execute', {
    schema: {
      body: {
        type: 'object',
        required: ['toolName'],
        properties: {
          toolName: { type: 'string' },
          arguments: { type: 'object' },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params as any
      const body = request.body as any
      try {
        const result = await mcpRuntimeService.executeTool(id, body.toolName, body.arguments || {})
        return { success: true, data: result }
      } catch (err: any) {
        reply.code(502)
        return { error: err.message }
      }
    },
  })

  app.get('/api/mcp/servers/:id/health', {
    handler: async (request, reply) => {
      const { id } = request.params as any
      const healthy = await mcpRuntimeService.checkHealth(id)
      return { healthy }
    },
  })

  // --- Local tool discovery and execution (synced tools) ---

  app.get('/api/mcp/tools', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          agentType: { type: 'string' },
          status: { type: 'string' },
        },
      },
    },
    handler: async (request) => {
      const { code, agentType, status } = request.query as any
      const db = databaseService.getClient()

      const where: any = {}
      if (code) where.code = code
      if (status) where.status = status

      let tools = await db.mcpTool.findMany({
        where,
        include: { server: { select: { name: true, url: true } } },
        orderBy: { name: 'asc' },
      })

      if (agentType) {
        const permissions = await db.mcpAgentPermission.findMany({
          where: { agent: { type: agentType } },
          select: { toolId: true },
        })
        const allowedIds = new Set(permissions.map(p => p.toolId))
        tools = tools.filter(t => allowedIds.has(t.id))
      }

      return {
        data: tools.map(t => ({
          id: t.id,
          code: t.code || t.name,
          name: t.name,
          description: t.description,
          executionType: t.executionType,
          status: t.status,
          version: t.version,
          serverId: t.serverId,
          serverName: (t as any).server?.name || null,
          schema: t.schema || t.inputSchema,
        })),
      }
    },
  })

  app.post('/api/mcp/tools/execute', {
    schema: {
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' },
          params: { type: 'object' },
        },
      },
    },
    handler: async (request, reply) => {
      const { code, params } = request.body as any
      const db = databaseService.getClient()

      const tool = await db.mcpTool.findFirst({
        where: { OR: [{ code }, { name: code }], status: 'ACTIVE' },
        include: { server: true },
      })

      if (!tool) {
        reply.code(404)
        return { error: `Tool not found: ${code}` }
      }

      try {
        let result: any

        if (tool.serverId && tool.server?.status === 'CONNECTED') {
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

        await db.toolExecution.create({
          data: {
            toolId: tool.id,
            status: 'COMPLETED',
            input: params || {},
            output: result,
          },
        })

        return { success: true, data: result }
      } catch (err: any) {
        reply.code(502)
        return { error: err.message }
      }
    },
  })
}
