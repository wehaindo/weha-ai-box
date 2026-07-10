import { NodeHandler } from '../../node-handler.js'

export const jsonNode: NodeHandler = {
  type: 'json',
  category: 'UTILITY',

  validate(config) {
    const errors: string[] = []
    if (!config.operation) errors.push('operation (parse/stringify/merge) is required')
    return errors
  },

  async execute(context) {
    const operation = context.node.config.operation as string
    const source = context.node.config.source as string
    const value = context.node.config.value
    const outputVar = context.node.config.outputVariable as string | undefined

    const sourceData = source ? context.variables[source] : value

    try {
      let result: unknown

      switch (operation) {
        case 'parse':
          result = typeof sourceData === 'string' ? JSON.parse(sourceData) : sourceData
          break

        case 'stringify':
          result = JSON.stringify(sourceData)
          break

        case 'merge': {
          const mergeWith = context.node.config.mergeWith as Record<string, unknown> | undefined
          result = { ...(sourceData as Record<string, unknown>), ...mergeWith }
          break
        }

        default:
          return { success: false, error: `Unknown JSON operation: ${operation}` }
      }

      return {
        success: true,
        output: outputVar ? { [outputVar]: result } : { _jsonResult: result },
      }
    } catch (err: any) {
      return { success: false, error: `JSON operation failed: ${err.message}` }
    }
  },
}
