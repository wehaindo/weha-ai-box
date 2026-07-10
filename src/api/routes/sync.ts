import { FastifyInstance } from 'fastify'
import { syncEngineService } from '../../modules/sync-engine/index.js'
import { licenseService } from '../../modules/sync-engine/license.service.js'
import { commandHandlerService } from '../../modules/sync-engine/commands/index.js'
import { databaseService } from '../../modules/database/database.service.js'

export async function syncRoutes(app: FastifyInstance) {
  app.get('/api/license', {
    handler: async () => {
      const license = await licenseService.getLicense()
      return { data: license }
    },
  })

  app.post('/api/license/activate', {
    schema: {
      body: {
        type: 'object',
        required: ['key'],
        properties: { key: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const { key } = request.body as any
      const result = await licenseService.setLicense(key)
      if (!result.success) {
        reply.code(400)
        return result
      }
      return result
    },
  })

  app.get('/api/sync/commands', {
    handler: async () => {
      const db = databaseService.getClient()
      const logs = await db.auditLog.findMany({
        where: { action: { in: ['RUNTIME_RESTART', 'AGENT_DEPLOY', 'AGENT_ROLLBACK', 'CONFIG_UPDATE'] } },
        orderBy: { timestamp: 'desc' },
        take: 50,
      })
      return { data: logs }
    },
  })

  app.post('/api/sync/command/restart', {
    handler: async () => {
      await commandHandlerService.restartRuntime()
      return { success: true }
    },
  })

  app.post('/api/sync/command/deploy', {
    handler: async (request, reply) => {
      try {
        await commandHandlerService.deployAgent(request.body as any)
        return { success: true }
      } catch (err: any) {
        reply.code(400)
        return { error: err.message }
      }
    },
  })

  app.post('/api/sync/command/rollback', {
    handler: async (request, reply) => {
      try {
        await commandHandlerService.rollbackAgent(request.body as any)
        return { success: true }
      } catch (err: any) {
        reply.code(400)
        return { error: err.message }
      }
    },
  })

  app.post('/api/sync/command/logs', {
    handler: async (request) => {
      const logs = await commandHandlerService.collectLogs(request.body as any)
      return { data: logs }
    },
  })

  app.post('/api/sync/agents', {
    handler: async (request, reply) => {
      try {
        await syncEngineService.triggerAgentSync()
        const status = syncEngineService.getStatus()
        return { success: true, status: status.agents }
      } catch (err: any) {
        request.log.error(err, 'Agent sync failed')
        reply.code(500)
        return { error: err.message }
      }
    },
  })

  app.post('/api/sync/mcp', {
    handler: async (request, reply) => {
      try {
        await syncEngineService.triggerMcpSync()
        const status = syncEngineService.getStatus()
        return { success: true, status: status.mcp }
      } catch (err: any) {
        request.log.error(err, 'MCP sync failed')
        reply.code(500)
        return { error: err.message }
      }
    },
  })

  app.get('/api/sync/status', {
    handler: async () => {
      const status = syncEngineService.getStatus()
      return {
        syncConfigured: true,
        licenseConfigured: true,
        ...status,
      }
    },
  })
}
