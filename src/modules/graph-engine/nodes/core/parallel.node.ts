import { NodeHandler } from '../../node-handler.js'

export const parallelNode: NodeHandler = {
  type: 'parallel',
  category: 'CORE',

  validate(config) {
    const errors: string[] = []
    if (!config.branches || !Array.isArray(config.branches)) {
      errors.push('branches must be an array')
    }
    return errors
  },

  async execute(context) {
    const branches = context.node.config.branches as string[] | undefined

    if (!branches || branches.length === 0) {
      return { success: true, output: { _parallelResults: [] } }
    }

    return {
      success: true,
      output: {
        _parallelBranches: branches,
        _parallelCount: branches.length,
      },
    }
  },
}
