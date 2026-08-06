import type { NodeHandler } from '../../node-handler.js'
import { llmProvider } from '../../../llm/llm-provider.service.js'

export const promptNode: NodeHandler = {
  type: 'prompt',
  category: 'AI',

  async execute(context) {
    const config = context.node.config
    const promptConfig = (config as any).prompt || {}
    const template = (typeof config.prompt === 'string' ? config.prompt : promptConfig.template) as string
    if (!template) {
      return { success: true, output: { prompt: '', response: '' } }
    }

    const rendered = template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      String(context.variables[key] ?? `{{${key}}}`),
    )

    const startTime = Date.now()
    try {
      const result = await llmProvider.complete({
        messages: [{ role: 'user', content: rendered }],
        model: promptConfig.model || config.model,
        temperature: promptConfig.temperature ?? config.temperature,
        maxTokens: promptConfig.maxTokens ?? config.maxTokens,
      })

      const duration = Date.now() - startTime
      await llmProvider.trackUsage({
        provider: result.model.includes('gpt') ? 'openai' : 'local',
        model: result.model,
        tokensIn: result.usage.promptTokens,
        tokensOut: result.usage.completionTokens,
        creditsUsed: 0,
        duration,
        executionId: context.executionId,
      })

      return {
        success: true,
        output: { prompt: rendered, response: result.content },
        tokenUsage: result.usage.completionTokens,
      }
    } catch (err: any) {
      return {
        success: false,
        error: `LLM call failed: ${err.message}`,
        output: { prompt: rendered },
      }
    }
  },
}
