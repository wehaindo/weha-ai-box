import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

export interface CrudOptions<T> {
  list?: {
    handler: (params: { page: number; limit: number; filter?: Record<string, unknown> }) => Promise<{ data: T[]; total: number }>
  }
  get?: {
    handler: (id: string) => Promise<T | null>
  }
  create?: {
    schema?: Record<string, unknown>
    handler: (data: unknown) => Promise<T>
  }
  update?: {
    handler: (id: string, data: unknown) => Promise<T>
  }
  delete?: {
    handler: (id: string) => Promise<void>
  }
}

export function createCrudRoutes<T>(app: FastifyInstance, prefix: string, options: CrudOptions<T>) {
  if (options.list) {
    app.get(prefix, async (request: FastifyRequest, _reply: FastifyReply) => {
      const { page = 1, limit = 20, ...filter } = request.query as Record<string, unknown>
      const result = await options.list!.handler({
        page: Number(page),
        limit: Number(limit),
        filter,
      })
      return result
    })
  }

  if (options.get) {
    app.get(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const result = await options.get!.handler(id)
      if (!result) {
        reply.code(404)
        return { error: 'Not found' }
      }
      return { data: result }
    })
  }

  if (options.create) {
    app.post(prefix, {
      schema: options.create.schema ? { body: options.create.schema } : undefined,
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        const result = await options.create!.handler(request.body)
        reply.code(201)
        return { data: result }
      },
    })
  }

  if (options.update) {
    app.patch(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const result = await options.update!.handler(id, request.body)
      return { data: result }
    })
  }

  if (options.delete) {
    app.delete(`${prefix}/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      await options.delete!.handler(id)
      reply.code(204)
      return
    })
  }
}
