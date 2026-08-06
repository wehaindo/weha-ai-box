import { FastifyInstance } from 'fastify'
import { databaseService } from '../../modules/database/database.service.js'
import { graphExecutor } from '../../modules/graph-engine/index.js'

export async function executionRoutes(app: FastifyInstance) {
  app.post('/api/executions', {
    schema: {
      body: {
        type: 'object',
        required: ['agentId'],
        properties: {
          agentId: { type: 'string' },
          agentDefinition: { type: 'object' },
          trigger: { type: 'string', default: 'MANUAL' },
          input: { type: 'object' },
        },
      },
    },
    handler: async (request, reply) => {
      const { agentId, agentDefinition, trigger, input } = request.body as any

      let definition = agentDefinition
      if (!definition) {
        const db = databaseService.getClient()
        const agent = await db.agent.findUnique({ where: { agentId } })
        if (!agent) {
          reply.code(404)
          return { error: `Agent not found: ${agentId}` }
        }
        if (!agent.definition) {
          reply.code(400)
          return { error: `Agent ${agentId} has no definition` }
        }
        definition = agent.definition
      }

      const db = databaseService.getClient()
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const execution = await db.execution.create({
        data: {
          executionId,
          agentId,
          status: 'RUNNING',
          trigger: trigger || 'MANUAL',
          input: input || {},
        },
      })

      graphExecutor.execute(definition, executionId, trigger || 'MANUAL', input || {})
        .then((result) => {
          console.log(`Execution ${executionId} completed:`, result.success ? 'OK' : 'FAIL')
        })
        .catch((err) => {
          console.error(`Execution ${executionId} error:`, err)
        })

      reply.code(201)
      return { data: execution }
    },
  })

  app.get('/api/executions', {
    handler: async (request) => {
      const query = request.query as any
      const page = Number(query.page) || 1
      const limit = Number(query.limit) || 20
      const status = query.status as string | undefined

      const db = databaseService.getClient()
      const where: any = {}
      if (status) where.status = status

      const [data, total] = await Promise.all([
        db.execution.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { agent: { select: { name: true } } },
        }),
        db.execution.count({ where }),
      ])

      return { data, total, page, limit }
    },
  })

  app.get('/api/executions/:executionId', {
    handler: async (request, reply) => {
      const { executionId } = request.params as any
      const db = databaseService.getClient()

      const execution = await db.execution.findUnique({
        where: { executionId },
        include: {
          checkpoints: { orderBy: { createdAt: 'asc' } },
          logs: { orderBy: { timestamp: 'asc' } },
        },
      })

      if (!execution) {
        reply.code(404)
        return { error: 'Execution not found' }
      }

      return { data: execution }
    },
  })

  app.post('/api/executions/:executionId/pause', {
    handler: async (request, reply) => {
      const { executionId } = request.params as any
      await graphExecutor.pause(executionId)
      return { success: true }
    },
  })

  app.post('/api/executions/:executionId/resume', {
    handler: async (request, reply) => {
      const { executionId } = request.params as any
      const success = await graphExecutor.resume(executionId)
      if (!success) {
        reply.code(404)
        return { error: 'No checkpoint found to resume from' }
      }
      return { success: true }
    },
  })

  app.post('/api/executions/:executionId/cancel', {
    handler: async (request) => {
      const { executionId } = request.params as any
      await graphExecutor.cancel(executionId)
      return { success: true }
    },
  })
}
