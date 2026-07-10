import { FastifyInstance } from 'fastify'
import { erpAuthService } from '../../modules/erp-connector/erp-auth.service.js'
import { erpClientService } from '../../modules/erp-connector/erp-client.service.js'

export async function erpRoutes(app: FastifyInstance) {
  app.get('/api/erp/status', {
    handler: async () => {
      return {
        configured: erpAuthService.isConfigured(),
      }
    },
  })

  app.post('/api/erp/configure', {
    schema: {
      body: {
        type: 'object',
        required: ['serverUrl', 'deviceToken', 'tenantId'],
        properties: {
          serverUrl: { type: 'string' },
          deviceToken: { type: 'string' },
          tenantId: { type: 'string' },
          deviceId: { type: 'string' },
          deviceCode: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as any
      erpAuthService.configure({
        serverUrl: body.serverUrl,
        deviceToken: body.deviceToken,
        tenantId: body.tenantId,
        deviceId: body.deviceId,
        deviceCode: body.deviceCode,
      })
      await erpAuthService.persist()
      reply.code(200)
      return { success: true, message: 'ERP credentials configured' }
    },
  })

  app.post('/api/erp/test', {
    handler: async (reply) => {
      if (!erpAuthService.isConfigured()) {
        reply.code(400)
        return { error: 'ERP not configured' }
      }
      try {
        const result = await erpClientService.query('health', { limit: 1 })
        return { success: true, message: 'ERP connection successful', data: result }
      } catch (err: any) {
        reply.code(502)
        return { error: `ERP connection failed: ${err.message}` }
      }
    },
  })
}
