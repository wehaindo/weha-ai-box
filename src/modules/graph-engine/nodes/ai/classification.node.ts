import type { NodeHandler } from '../../node-handler.js'
import { llmProvider } from '../../../llm/llm-provider.service.js'

export const classificationNode: NodeHandler = {
  type: 'classification',
  category: 'AI',

  async execute(context) {
    const config = context.node.config
    const text = Object.entries(context.variables)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n')

    const categories = (config as any).classification?.categories || []
    const system = `You are a classification engine. Classify the input into exactly one of: ${categories.join(', ')}. Respond with only the category name.`

    try {
      const result = await llmProvider.complete({
        system,
        messages: [{ role: 'user', content: text }],
        model: (config as any).classification?.model || config.model,
        temperature: (config as any).classification?.temperature ?? 0.1,
        maxTokens: (config as any).classification?.maxTokens ?? 50,
      })

      await llmProvider.trackUsage({
        provider: result.model.includes('gpt') ? 'openai' : 'local',
        model: result.model,
        tokensIn: result.usage.promptTokens,
        tokensOut: result.usage.completionTokens,
        creditsUsed: 0,
        duration: 0,
        executionId: context.executionId,
      })

      const classification = result.content.trim()
      return {
        success: true,
        output: {
          classification,
          categories,
        },
        tokenUsage: result.usage.completionTokens,
      }
    } catch (err: any) {
      return { success: false, error: `LLM classification failed: ${err.message}` }
    }
  },
}
