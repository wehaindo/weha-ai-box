import { FastifyInstance } from 'fastify'
import { llmProvider } from '../../modules/llm/llm-provider.service.js'

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings/llm', {
    handler: async () => {
      const config = llmProvider.getConfig()
      const status = llmProvider.getStatus()
      return { data: { ...config, ...status } }
    },
  })

  app.post('/api/settings/llm', {
    schema: {
      body: {
        type: 'object',
        properties: {
          apiKey: { type: 'string' },
          baseUrl: { type: 'string' },
          model: { type: 'string' },
          fallbackApiKey: { type: 'string' },
          fallbackBaseUrl: { type: 'string' },
          fallbackModel: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as any
      await llmProvider.applyConfig({
        apiKey: body.apiKey || '',
        baseUrl: body.baseUrl || 'https://api.openai.com/v1',
        model: body.model || 'gpt-4o-mini',
        fallbackApiKey: body.fallbackApiKey,
        fallbackBaseUrl: body.fallbackBaseUrl,
        fallbackModel: body.fallbackModel,
      })
      return { success: true }
    },
  })

  app.post('/api/settings/llm/test', {
    handler: async () => {
      const result = await llmProvider.testConnection()
      return result
    },
  })
}
