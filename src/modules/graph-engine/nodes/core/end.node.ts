import { NodeHandler } from '../../node-handler.js'

export const endNode: NodeHandler = {
  type: 'end',
  category: 'CORE',

  async execute(context) {
    return {
      success: true,
      output: {
        ...context.variables,
        _completedAt: new Date().toISOString(),
      },
    }
  },
}
