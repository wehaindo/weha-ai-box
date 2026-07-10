import { NodeHandler } from '../../node-handler.js'

export const transformNode: NodeHandler = {
  type: 'transform',
  category: 'UTILITY',

  validate(config) {
    const errors: string[] = []
    if (!config.expression && !config.template) {
      errors.push('expression or template is required')
    }
    return errors
  },

  async execute(context) {
    const expression = context.node.config.expression as string | undefined
    const template = context.node.config.template as string | undefined
    const outputVar = context.node.config.outputVariable as string | undefined

    if (expression) {
      try {
        const fn = new Function('vars', `"use strict"; return (${expression})`)
        const result = fn(context.variables)
        return {
          success: true,
          output: outputVar ? { [outputVar]: result } : { _transformResult: result },
        }
      } catch (err: any) {
        return { success: false, error: `Transform expression failed: ${err.message}` }
      }
    }

    if (template) {
      const result = template.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string) => {
        return String(context.variables[key] ?? '')
      })
      return {
        success: true,
        output: outputVar ? { [outputVar]: result } : { _transformResult: result },
      }
    }

    return { success: false, error: 'No transform expression or template provided' }
  },
}
