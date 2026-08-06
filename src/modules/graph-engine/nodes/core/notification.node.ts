import type { NodeHandler } from '../../node-handler.js'
import { databaseService } from '../../../database/database.service.js'

export const notificationNode: NodeHandler = {
  type: 'notification',
  category: 'COMMUNICATION',
  validate(config) {
    const errors: string[] = []
    if (!config.notification?.title) errors.push('notification.title is required')
    if (!config.notification?.message) errors.push('notification.message is required')
    return errors
  },
  async execute(context) {
    const config = context.node.config
    const title = fillTemplate(config.notification?.title || '', context.variables)
    const message = fillTemplate(config.notification?.message || '', context.variables)
    const notifType = config.notification?.type || 'info'

    try {
      const db = databaseService.getClient()
      await db.auditLog.create({
        data: {
          action: 'NOTIFICATION',
          entityType: 'execution',
          entityId: context.executionId,
          metadata: { type: notifType, title, message, agentId: context.agentId },
        },
      })
    } catch {
      // non-critical
    }

    return {
      success: true,
      output: { notificationSent: true, type: notifType, title, message },
    }
  },
}

function fillTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key]
    return val !== undefined ? String(val) : `{{${key}}}`
  })
}
