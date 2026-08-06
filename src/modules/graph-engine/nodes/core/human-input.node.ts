import type { NodeHandler } from '../../node-handler.js'

export const humanInputNode: NodeHandler = {
  type: 'human_input',
  category: 'CORE',
  validate(config) {
    const errors: string[] = []
    if (!config.human_input?.prompt) errors.push('human_input.prompt is required')
    return errors
  },
  async execute(context) {
    const config = context.node.config

    return {
      success: true,
      output: {
        prompt: config.human_input?.prompt,
        expectedType: config.human_input?.expectedType || 'text',
        timeout: config.human_input?.timeout || 300000,
      },
      pauseForApproval: true,
    }
  },
}
