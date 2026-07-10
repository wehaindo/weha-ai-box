import { NodeHandler } from '../../node-handler.js'
import { notificationGateway } from '../../../notification-gateway/notification-gateway.service.js'

export const pushNode: NodeHandler = {
  type: 'push',
  category: 'COMMUNICATION',

  validate(config) {
    const errors: string[] = []
    if (!config.title) errors.push('title is required')
    if (!config.tokens && !config.tokenExpr) errors.push('tokens or tokenExpr is required')
    return errors
  },

  async execute(context) {
    const outputVar = context.node.config.outputVariable as string || '_pushResult'

    let tokens: string[]
    if (context.node.config.tokens) {
      tokens = context.node.config.tokens as string[]
    } else if (context.node.config.tokenExpr) {
      tokens = new Function('vars', `"use strict"; return (${context.node.config.tokenExpr})`)(context.variables) as string[]
    } else {
      return { success: false, error: 'No device tokens specified' }
    }

    try {
      const results = await notificationGateway.send({
        type: (context.node.config.notificationType as any) || 'INFO',
        title: context.node.config.title as string,
        message: context.node.config.message as string || '',
        recipientIds: tokens,
        priority: (context.node.config.priority as any) || 'MEDIUM',
        channels: ['firebase'],
      })

      return { success: true, output: { [outputVar]: results } }
    } catch (err: any) {
      return { success: false, error: `Push notification failed: ${err.message}` }
    }
  },
}
