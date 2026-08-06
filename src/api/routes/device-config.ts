import { FastifyInstance } from 'fastify'
import { deviceConfigService } from '../../modules/device-config/device-config.service.js'

export async function deviceConfigRoutes(app: FastifyInstance) {
  app.get('/api/device/config', {
    handler: async () => {
      const config = deviceConfigService.get()
      return { data: config }
    },
  })

  app.post('/api/device/config', {
    schema: {
      body: { type: 'object' },
    },
    handler: async (request) => {
      const body = request.body as Record<string, unknown>
      const config = await deviceConfigService.save(body)
      return { data: config }
    },
  })

  app.delete('/api/device/config', {
    handler: async () => {
      await deviceConfigService.clearCredentials()
      return { success: true }
    },
  })

  app.post('/api/device/activate', {
    schema: {
      body: {
        type: 'object',
        required: ['serverUrl', 'token'],
        properties: {
          serverUrl: { type: 'string' },
          token: { type: 'string' },
          clientInfo: {
            type: 'object',
            properties: {
              ipAddress: { type: ['string', 'null'] },
              userAgent: { type: 'string' },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { serverUrl, token, clientInfo } = request.body as {
        serverUrl: string
        token: string
        clientInfo?: { ipAddress?: string | null; userAgent?: string }
      }
      try {
        const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/device/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, clientInfo }),
          signal: AbortSignal.timeout(15000),
        })
        const data = await res.json().catch(() => ({}))
        reply.code(res.status)
        return { ok: res.ok, status: res.status, data }
      } catch (err: any) {
        reply.code(502)
        return { ok: false, status: 502, error: err.message || 'Failed to reach server' }
      }
    },
  })

  app.post('/api/device/register-feature', {
    handler: async (_request, reply) => {
      const config = deviceConfigService.get()
      if (!config.deviceToken || !config.tenantId || !config.deviceCode || !config.serverUrl) {
        reply.code(400)
        return { ok: false, status: 400, error: 'Device is not registered' }
      }
      try {
        const res = await fetch(`${config.serverUrl.replace(/\/$/, '')}/api/device/v1/register-feature`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.deviceToken}`,
            'X-Tenant-ID': config.tenantId,
          },
          body: JSON.stringify({ deviceCode: config.deviceCode }),
          signal: AbortSignal.timeout(15000),
        })
        const data = await res.json().catch(() => ({}))
        reply.code(res.status)
        return { ok: res.ok, status: res.status, data }
      } catch (err: any) {
        reply.code(502)
        return { ok: false, status: 502, error: err.message || 'Failed to reach server' }
      }
    },
  })
}
