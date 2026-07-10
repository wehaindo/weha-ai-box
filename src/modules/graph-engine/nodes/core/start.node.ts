import { NodeHandler } from '../../node-handler.js'

export const startNode: NodeHandler = {
  type: 'start',
  category: 'CORE',

  validate(config) {
    const errors: string[] = []
    const outputVars = config.outputVariables
    if (outputVars && !Array.isArray(outputVars)) {
      errors.push('outputVariables must be an array')
    }
    return errors
  },

  async execute(context) {
    return {
      success: true,
      output: {
        ...context.input,
        _startedAt: new Date().toISOString(),
      },
    }
  },
}
