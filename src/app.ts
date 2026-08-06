import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { env } from './config/env.js'
import { registerErrorHandler } from './api/middleware/index.js'
import { healthRoutes } from './api/routes/health.js'
import { authRoutes } from './api/routes/auth.js'
import { executionRoutes } from './api/routes/executions.js'
import { scheduleRoutes } from './api/routes/schedules.js'
import { erpRoutes } from './api/routes/erp.js'
import { mcpRoutes } from './api/routes/mcp.js'
import { mcpPublicRoutes } from './api/routes/mcp-public.js'
import { notificationRoutes } from './api/routes/notifications.js'
import { syncRoutes } from './api/routes/sync.js'
import { agentRoutes } from './api/routes/agents.js'
import { settingsRoutes } from './api/routes/settings.js'
import { deviceConfigRoutes } from './api/routes/device-config.js'
import { chatRoutes } from './api/routes/chat.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  })

  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
    } catch {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  // Tolerate empty JSON bodies (some clients send Content-Type: application/json
  // with an empty body, which Fastify would otherwise reject as invalid).
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    try {
      const text = String(body || '').trim()
      const parsed = text === '' ? {} : JSON.parse(text)
      done(null, parsed)
    } catch (err) {
      done(err as Error, undefined)
    }
  })

  registerErrorHandler(app)

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'WEHA AI Box API',
        description: 'Local API Gateway for WEHA AI Box management',
        version: '1.0.0',
      },
    },
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  })

  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(executionRoutes)
  await app.register(scheduleRoutes)
  await app.register(erpRoutes)
  await app.register(mcpRoutes)
  await app.register(mcpPublicRoutes)
  await app.register(notificationRoutes)
  await app.register(syncRoutes)
  await app.register(agentRoutes)
  await app.register(settingsRoutes)
  await app.register(deviceConfigRoutes)
  await app.register(chatRoutes)

  return app
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}
