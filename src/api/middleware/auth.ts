import { FastifyRequest, FastifyReply } from 'fastify'

export interface AuthenticatedUser {
  id: string
  email: string
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER'
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser
  }
}

export function requireRole(...roles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as AuthenticatedUser | undefined
    if (!user) {
      reply.code(401).send({ error: 'Unauthorized' })
      return
    }
    if (!roles.includes(user.role)) {
      reply.code(403).send({ error: 'Forbidden: insufficient role' })
      return
    }
  }
}
