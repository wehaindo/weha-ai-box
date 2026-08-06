import { FastifyInstance } from 'fastify'
import { databaseService } from '../../modules/database/database.service.js'

export async function agentRoutes(app: FastifyInstance) {
  app.get('/api/agents', {
    handler: async () => {
      const db = databaseService.getClient()
      const agents = await db.agent.findMany({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: {
          agentId: true,
          code: true,
          name: true,
          description: true,
          type: true,
          version: true,
          status: true,
          isActive: true,
          checksum: true,
          deployedAt: true,
          updatedAt: true,
          createdAt: true,
        },
      })
      return { data: agents }
    },
  })

  app.get('/api/agents/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as any
      const db = databaseService.getClient()
      const agent = await db.agent.findUnique({
        where: { agentId: id },
      })
      if (!agent) {
        reply.code(404)
        return { error: 'Agent not found' }
      }
      return { data: agent }
    },
  })
}
