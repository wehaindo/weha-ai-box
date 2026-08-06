import type { NodeHandler } from '../../node-handler.js'
import { llmProvider } from '../../../llm/llm-provider.service.js'

export const summaryNode: NodeHandler = {
  type: 'summary',
  category: 'AI',

  async execute(context) {
    const config = context.node.config
    const text = Object.entries(context.variables)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n')

    const maxLen = (config as any).summary?.maxLength ?? 200
    const system = `You are a summarization engine. Summarize the following text in at most ${maxLen} characters.`

    try {
      const result = await llmProvider.complete({
        system,
        messages: [{ role: 'user', content: text }],
        model: (config as any).summary?.model || config.model,
        temperature: (config as any).summary?.temperature ?? 0.3,
        maxTokens: (config as any).summary?.maxTokens ?? 300,
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

      return {
        success: true,
        output: { summary: result.content },
        tokenUsage: result.usage.completionTokens,
      }
    } catch (err: any) {
      return { success: false, error: `LLM summarization failed: ${err.message}` }
    }
  },
}
