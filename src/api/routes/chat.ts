import { FastifyInstance } from 'fastify'
import { conversationService } from '../../modules/chat/conversation.service.js'
import { chatService } from '../../modules/chat/chat.service.js'
import { getChatTools } from '../../modules/chat/tools.js'

export async function chatRoutes(app: FastifyInstance) {
  app.post('/api/chat/conversations', {
    handler: async (request, reply) => {
      const body = request.body as { title?: string } | null
      const conversation = await conversationService.createConversation(body?.title)
      reply.code(201)
      return { data: conversation }
    },
  })

  app.get('/api/chat/conversations', {
    handler: async () => {
      const conversations = await conversationService.listConversations()
      return { data: conversations }
    },
  })

  app.get('/api/chat/conversations/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as any
      const conversation = await conversationService.getConversation(id)
      if (!conversation) {
        reply.code(404)
        return { error: 'Conversation not found' }
      }
      return { data: conversation }
    },
  })

  app.patch('/api/chat/conversations/:id', {
    schema: {
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 120 },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params as any
      const { title } = request.body as { title: string }
      const titleValue = title.trim()
      if (!titleValue) {
        reply.code(400)
        return { error: 'Title is required' }
      }
      const conversation = await conversationService.getConversation(id)
      if (!conversation) {
        reply.code(404)
        return { error: 'Conversation not found' }
      }
      await conversationService.updateTitle(id, titleValue)
      return { data: { id, title: titleValue } }
    },
  })

  app.delete('/api/chat/conversations/:id', {
    handler: async (request, reply) => {
      const { id } = request.params as any
      const success = await conversationService.deleteConversation(id)
      if (!success) {
        reply.code(404)
        return { error: 'Conversation not found' }
      }
      return { success: true }
    },
  })

  app.post('/api/chat/conversations/:id/messages', {
    schema: {
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1 },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params as any
      const { content } = request.body as any

      if (!content || !content.trim()) {
        reply.code(400)
        return { error: 'Message content is required' }
      }

      try {
        const result = await chatService.sendMessage(id, content.trim())
        return { data: result }
      } catch (err: any) {
        reply.code(500)
        return { error: err.message }
      }
    },
  })

  app.get('/api/chat/tools', {
    handler: async () => {
      const tools = await getChatTools()
      return {
        data: tools.map((t) => ({
          functionName: t.functionName,
          kind: t.kind,
          name: t.name,
          description: t.description,
          schema: t.schema,
        })),
      }
    },
  })
}
