import { FastifyInstance } from 'fastify'
import { databaseService } from '../../modules/database/database.service.js'
import { schedulerService } from '../../modules/scheduler/index.js'
import { createCrudRoutes } from '../route-factory.js'

export async function scheduleRoutes(app: FastifyInstance) {
  createCrudRoutes(app, '/api/schedules', {
    list: {
      handler: async ({ page, limit }) => {
        const db = databaseService.getClient()
        const [data, total] = await Promise.all([
          db.schedule.findMany({
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          db.schedule.count(),
        ])
        return { data, total }
      },
    },
    get: {
      handler: async (id) => {
        const db = databaseService.getClient()
        return await db.schedule.findUnique({ where: { id } })
      },
    },
    create: {
      handler: async (data) => {
        const input = data as any
        return await schedulerService.createSchedule({
          agentId: input.agentId,
          name: input.name,
          type: input.type,
          cron: input.cron,
          startAt: input.startAt ? new Date(input.startAt) : undefined,
          config: input.config,
        })
      },
    },
    delete: {
      handler: async (id) => {
        const db = databaseService.getClient()
        await db.schedule.update({
          where: { id },
          data: { isActive: false },
        })
      },
    },
  })
}
