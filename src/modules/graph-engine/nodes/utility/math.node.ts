import { NodeHandler } from '../../node-handler.js'

export const mathNode: NodeHandler = {
  type: 'math',
  category: 'UTILITY',

  validate(config) {
    const errors: string[] = []
    if (!config.expression) errors.push('expression is required')
    return errors
  },

  async execute(context) {
    const expression = context.node.config.expression as string
    const outputVar = context.node.config.outputVariable as string | undefined

    if (!expression) {
      return { success: false, error: 'Math expression is required' }
    }

    try {
      const fn = new Function('vars', 'Math', `"use strict"; return (${expression})`)
      const result = fn(context.variables, Math)

      return {
        success: true,
        output: outputVar ? { [outputVar]: result } : { _mathResult: result },
      }
    } catch (err: any) {
      return { success: false, error: `Math evaluation failed: ${err.message}` }
    }
  },
}
