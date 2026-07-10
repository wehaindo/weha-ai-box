import { FastifyInstance } from 'fastify'
import { mcpRuntimeService } from '../../modules/mcp-runtime/mcp-runtime.service.js'
import { databaseService } from '../../modules/database/database.service.js'

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
}
