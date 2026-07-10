import { FastifyInstance } from 'fastify'
import { notificationGateway } from '../../modules/notification-gateway/notification-gateway.service.js'
import { notificationQueueService } from '../../modules/notification-gateway/notification-queue.service.js'
import { whotifProvider } from '../../modules/notification-gateway/providers/whotif.provider.js'
import { telegramProvider } from '../../modules/notification-gateway/providers/telegram.provider.js'
import { emailProvider } from '../../modules/notification-gateway/providers/email.provider.js'
import { firebaseProvider } from '../../modules/notification-gateway/providers/firebase.provider.js'
import { smsProvider } from '../../modules/notification-gateway/providers/sms.provider.js'

export async function notificationRoutes(app: FastifyInstance) {
  app.post('/api/notifications/send', {
    schema: {
      body: {
        type: 'object',
        required: ['type', 'title', 'message', 'recipientIds'],
        properties: {
          type: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          recipientIds: { type: 'array', items: { type: 'string' } },
          priority: { type: 'string' },
          channels: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as any
      const results = await notificationGateway.send(body)
      reply.code(201)
      return { data: results }
    },
  })

  app.post('/api/notifications/send-async', {
    handler: async (request, reply) => {
      const body = request.body as any
      const id = await notificationGateway.sendAsync(body)
      reply.code(202)
      return { queueId: id }
    },
  })

  app.post('/api/notifications/approval-response', {
    handler: async (request) => {
      const body = request.body as any
      await notificationGateway.handleApprovalResponse(body)
      return { success: true }
    },
  })

  app.get('/api/notifications/queue-status', {
    handler: async () => {
      return { queueLength: notificationQueueService.getQueueLength() }
    },
  })

  app.get('/api/notifications/providers', {
    handler: async () => {
      return {
        providers: {
          whotif: { configured: !!whotifProvider },
          telegram: { configured: telegramProvider.isConfigured() },
          email: { configured: emailProvider.isConfigured() },
          firebase: { configured: firebaseProvider.isConfigured() },
          sms: { configured: smsProvider.isConfigured() },
        },
      }
    },
  })
}
