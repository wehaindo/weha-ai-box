import { NodeHandler } from '../../node-handler.js'

export const delayNode: NodeHandler = {
  type: 'delay',
  category: 'CORE',

  validate(config) {
    const errors: string[] = []
    if (!config.duration && !config.durationMs) {
      errors.push('duration or durationMs is required')
    }
    return errors
  },

  async execute(context) {
    const durationMs = (context.node.config.durationMs as number) ?? (context.node.config.duration as number) ?? 0

    if (durationMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, durationMs))
    }

    return {
      success: true,
      output: {
        _delayedMs: durationMs,
        _delayedUntil: new Date().toISOString(),
      },
    }
  },
}
