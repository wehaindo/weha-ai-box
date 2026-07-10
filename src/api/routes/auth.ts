import { FastifyInstance } from 'fastify'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { email, password } = loginSchema.parse(request.body)

      // Phase 1: stub auth — will be replaced with real user lookup in Phase 1.2
      if (email === 'admin@weha.ai' && password === 'admin') {
        const token = app.jwt.sign({ id: '1', email, role: 'ADMIN' })
        return {
          token,
          user: { id: '1', email, name: 'Admin', role: 'ADMIN' },
        }
      }

      reply.code(401)
      return { error: 'Invalid credentials' }
    },
  })

  app.post('/api/auth/verify', {
    onRequest: [app.authenticate],
    handler: async (request) => {
      return { valid: true, user: request.user }
    },
  })
}
