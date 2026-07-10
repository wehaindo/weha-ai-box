import { NodeHandler } from '../../node-handler.js'

export const waitNode: NodeHandler = {
  type: 'wait',
  category: 'CORE',

  validate(config) {
    const errors: string[] = []
    if (!config.eventType && !config.condition) {
      errors.push('eventType or condition is required')
    }
    return errors
  },

  async execute(context) {
    const eventType = context.node.config.eventType as string | undefined
    const condition = context.node.config.condition as string | undefined

    return {
      success: true,
      output: {
        _waitEventType: eventType,
        _waitCondition: condition,
        _waitStartedAt: new Date().toISOString(),
      },
      pauseForApproval: true,
    }
  },
}
