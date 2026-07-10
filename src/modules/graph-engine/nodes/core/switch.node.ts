import { NodeHandler } from '../../node-handler.js'

export const switchNode: NodeHandler = {
  type: 'switch',
  category: 'CORE',

  validate(config) {
    const errors: string[] = []
    if (!config.cases || !Array.isArray(config.cases)) {
      errors.push('cases must be an array')
    }
    return errors
  },

  async execute(context) {
    const cases = context.node.config.cases as Array<{ value: string; target: string }> | undefined
    const expression = context.node.config.expression as string | undefined
    const variable = context.node.config.variable as string | undefined

    if (!cases || cases.length === 0) {
      return { success: false, error: 'No switch cases defined' }
    }

    const value = variable ? context.variables[variable] : context.variables
    const expressionValue = expression
      ? new Function('vars', `"use strict"; return (${expression})`)(context.variables)
      : value

    const matchedCase = cases.find((c) => String(c.value) === String(expressionValue))

    return {
      success: true,
      output: {
        _switchValue: expressionValue,
        _matchedCase: matchedCase?.value || 'default',
      },
    }
  },
}
