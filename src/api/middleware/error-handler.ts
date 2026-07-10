import { FastifyInstance, FastifyError } from 'fastify'
import { ZodError } from 'zod'

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError | ZodError, request, reply) => {
    request.log.error(error)

    if (error instanceof ZodError) {
      reply.code(400)
      return {
        error: 'Validation Error',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      }
    }

    if (error.statusCode === 401) {
      reply.code(401)
      return { error: 'Unauthorized' }
    }

    if (error.statusCode === 403) {
      reply.code(403)
      return { error: 'Forbidden' }
    }

    if (error.statusCode === 404) {
      reply.code(404)
      return { error: 'Not found' }
    }

    if (error.statusCode === 409) {
      reply.code(409)
      return { error: error.message }
    }

    reply.code(error.statusCode || 500)
    return {
      error: error.statusCode === 500 ? 'Internal server error' : error.message,
    }
  })
}
