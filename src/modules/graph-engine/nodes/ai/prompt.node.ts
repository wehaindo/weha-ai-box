import { NodeHandler } from '../../node-handler.js'

export const promptNode: NodeHandler = {
  type: 'prompt',
  category: 'AI',

  execute: async (context) => {
    const template: string = (context.node.config?.prompt as string) || ''
    if (!template) {
      return { success: true, output: { prompt: '', response: '' } }
    }
    const rendered = template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      String(context.variables[key] ?? `{{${key}}}`),
    )
    return {
      success: true,
      output: { prompt: rendered, response: '[AI Box: LLM not yet configured]' },
    }
  },
}
