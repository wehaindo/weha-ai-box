import { NodeHandler } from '../../node-handler.js'

export const dateNode: NodeHandler = {
  type: 'date',
  category: 'UTILITY',

  validate(config) {
    const errors: string[] = []
    if (!config.operation) errors.push('operation (now/format/parse/add/diff) is required')
    return errors
  },

  async execute(context) {
    const operation = context.node.config.operation as string
    const outputVar = context.node.config.outputVariable as string | undefined

    const now = new Date()

    switch (operation) {
      case 'now': {
        const format = context.node.config.format as string | undefined
        const result = format === 'timestamp' ? now.getTime() : format === 'iso' ? now.toISOString() : now.toISOString()
        return { success: true, output: outputVar ? { [outputVar]: result } : { _dateNow: result } }
      }

      case 'format': {
        const source = context.node.config.source as string
        const sourceVar = context.variables[source] as string
        const date = new Date(sourceVar || source)
        const result = date.toISOString()
        return { success: true, output: outputVar ? { [outputVar]: result } : { _dateFormatted: result } }
      }

      case 'parse': {
        const source2 = context.node.config.source as string
        const sourceVar2 = context.variables[source2] as string
        const parsed = new Date(sourceVar2 || source2)
        return {
          success: true,
          output: outputVar ? { [outputVar]: parsed.toISOString() } : { _dateParsed: parsed.toISOString() },
        }
      }

      case 'add': {
        const source3 = context.node.config.source as string
        const sourceVar3 = context.variables[source3] as string
        const amount = (context.node.config.amount as number) || 0
        const unit = (context.node.config.unit as string) || 'days'
        const baseDate = new Date(sourceVar3 || source3 || now)

        const multipliers: Record<string, number> = {
          milliseconds: 1,
          seconds: 1000,
          minutes: 60000,
          hours: 3600000,
          days: 86400000,
          weeks: 604800000,
        }

        baseDate.setTime(baseDate.getTime() + amount * (multipliers[unit] || 86400000))
        return {
          success: true,
          output: outputVar ? { [outputVar]: baseDate.toISOString() } : { _dateAdded: baseDate.toISOString() },
        }
      }

      case 'diff': {
        const a = context.node.config.dateA as string
        const b = context.node.config.dateB as string
        const dateA = new Date(context.variables[a] as string || a)
        const dateB = new Date(context.variables[b] as string || b)
        const diffMs = dateB.getTime() - dateA.getTime()
        return {
          success: true,
          output: outputVar ? { [outputVar]: diffMs } : { _dateDiffMs: diffMs },
        }
      }

      default:
        return { success: false, error: `Unknown date operation: ${operation}` }
    }
  },
}
