import { NodeHandler } from '../../node-handler.js'

function evaluateExpression(expression: string, variables: Record<string, unknown>): boolean {
  const filled = expression.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const val = variables[key]
    if (val === undefined) return 'undefined'
    if (typeof val === 'string') return `"${val}"`
    return String(val)
  })

  try {
    const fn = new Function('vars', `"use strict"; return (${filled})`)
    return Boolean(fn(variables))
  } catch {
    return false
  }
}

export const conditionNode: NodeHandler = {
  type: 'condition',
  category: 'CORE',

  validate(config) {
    const errors: string[] = []
    if (!config.condition) errors.push('condition expression is required')
    return errors
  },

  async execute(context) {
    const expression = context.node.config.condition as string
    if (!expression) {
      return { success: false, error: 'No condition expression defined' }
    }

    const result = evaluateExpression(expression, context.variables)

    return {
      success: true,
      output: {
        _condition: expression,
        _conditionResult: result,
      },
    }
  },
}
