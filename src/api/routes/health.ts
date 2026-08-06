import { FastifyInstance } from 'fastify'
import { databaseService } from '../../modules/database/database.service.js'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            uptime: { type: 'number' },
            database: { type: 'string' },
            version: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
    handler: async (_request, _reply) => {
      const dbStatus = await databaseService.checkHealth()
      return {
        status: 'ok',
        uptime: process.uptime(),
        database: dbStatus ? 'connected' : 'disconnected',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
      }
    },
  })

  app.get('/api/health/ready', {
    handler: async (_request, reply) => {
      const dbHealthy = await databaseService.checkHealth()
      if (!dbHealthy) {
        reply.code(503)
        return { status: 'not ready', database: 'disconnected' }
      }
      return { status: 'ready', database: 'connected' }
    },
  })
}
