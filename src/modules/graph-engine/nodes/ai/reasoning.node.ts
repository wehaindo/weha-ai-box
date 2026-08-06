import type { NodeHandler } from '../../node-handler.js'
import { llmProvider } from '../../../llm/llm-provider.service.js'

export const reasoningNode: NodeHandler = {
  type: 'reasoning',
  category: 'AI',

  async execute(context) {
    const config = context.node.config
    const contextText = Object.entries(context.variables)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n')

    const system = 'You are a reasoning engine. Think step by step and provide a clear, logical analysis.'

    try {
      const result = await llmProvider.complete({
        system,
        messages: [{ role: 'user', content: contextText }],
        model: (config as any).reasoning?.model || config.model,
        temperature: (config as any).reasoning?.temperature ?? 0.5,
        maxTokens: (config as any).reasoning?.maxTokens ?? 1000,
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
        output: { reasoning: result.content },
        tokenUsage: result.usage.completionTokens,
      }
    } catch (err: any) {
      return { success: false, error: `LLM reasoning failed: ${err.message}` }
    }
  },
}
