import { databaseService } from '../database/database.service.js'

class AuditService {
  async log(params: {
    action: string
    entityType: string
    entityId?: string
    userId?: string
    metadata?: Record<string, unknown>
    ipAddress?: string
  }) {
    try {
      const db = databaseService.getClient()
      await db.auditLog.create({
        data: {
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: params.userId,
          metadata: params.metadata ?? {},
          ipAddress: params.ipAddress,
        },
      })
    } catch (error) {
      console.error('Failed to write audit log:', error)
    }
  }

  async list(params: {
    page?: number
    limit?: number
    entityType?: string
    action?: string
    userId?: string
  }) {
    const db = databaseService.getClient()
    const where: Record<string, unknown> = {}
    if (params.entityType) where.entityType = params.entityType
    if (params.action) where.action = params.action
    if (params.userId) where.userId = params.userId

    const [data, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: ((params.page ?? 1) - 1) * (params.limit ?? 20),
        take: params.limit ?? 20,
      }),
      db.auditLog.count({ where }),
    ])

    return { data, total, page: params.page ?? 1, limit: params.limit ?? 20 }
  }
}

export const auditService = new AuditService()
