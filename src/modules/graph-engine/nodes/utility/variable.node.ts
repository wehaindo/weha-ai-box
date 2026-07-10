import { NodeHandler } from '../../node-handler.js'

export const variableNode: NodeHandler = {
  type: 'variable',
  category: 'UTILITY',

  validate(config) {
    const errors: string[] = []
    if (!config.operation) errors.push('operation (set/get/delete) is required')
    if (config.operation === 'set' && !config.name) errors.push('name is required for set operation')
    return errors
  },

  async execute(context) {
    const operation = context.node.config.operation as string
    const name = context.node.config.name as string
    const value = context.node.config.value

    switch (operation) {
      case 'set':
        return {
          success: true,
          output: { [name]: value ?? context.variables[name] },
        }

      case 'get':
        return {
          success: true,
          output: { [`_${name}`]: context.variables[name] },
        }

      case 'delete': {
        const { [name]: _, ...rest } = context.variables
        return {
          success: true,
          output: rest,
        }
      }

      default:
        return { success: false, error: `Unknown variable operation: ${operation}` }
    }
  },
}
