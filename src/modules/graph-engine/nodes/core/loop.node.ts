import { NodeHandler } from '../../node-handler.js'

export const loopNode: NodeHandler = {
  type: 'loop',
  category: 'CORE',

  validate(config) {
    const errors: string[] = []
    if (!config.iterator) errors.push('iterator variable name is required')
    if (!config.collection) errors.push('collection expression is required')
    return errors
  },

  async execute(context) {
    const iterator = context.node.config.iterator as string
    const collectionExpr = context.node.config.collection as string

    if (!iterator || !collectionExpr) {
      return { success: false, error: 'Loop requires iterator and collection' }
    }

    let collection: unknown[]
    try {
      const fn = new Function('vars', `"use strict"; return (${collectionExpr})`)
      collection = fn(context.variables) as unknown[]
    } catch {
      return { success: false, error: `Failed to evaluate collection: ${collectionExpr}` }
    }

    if (!Array.isArray(collection)) {
      return { success: false, error: `Collection expression did not return an array` }
    }

    return {
      success: true,
      output: {
        [`_${iterator}_collection`]: collection,
        [`_${iterator}_length`]: collection.length,
        [`_${iterator}_index`]: 0,
      },
    }
  },
}
