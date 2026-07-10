import { NodeHandler } from '../../node-handler.js'
import { notificationGateway } from '../../../notification-gateway/notification-gateway.service.js'

export const telegramNode: NodeHandler = {
  type: 'telegram',
  category: 'COMMUNICATION',

  validate(config) {
    const errors: string[] = []
    if (!config.message && !config.messageExpr) errors.push('message or messageExpr is required')
    if (!config.chatIds && !config.chatIdExpr) errors.push('chatIds or chatIdExpr is required')
    return errors
  },

  async execute(context) {
    const outputVar = context.node.config.outputVariable as string || '_telegramResult'

    const message = context.node.config.message
      ? String(context.node.config.message)
      : context.node.config.messageExpr
        ? new Function('vars', `"use strict"; return String(${context.node.config.messageExpr})`)(context.variables)
        : ''

    let chatIds: string[]
    if (context.node.config.chatIds) {
      chatIds = context.node.config.chatIds as string[]
    } else if (context.node.config.chatIdExpr) {
      chatIds = new Function('vars', `"use strict"; return (${context.node.config.chatIdExpr})`)(context.variables) as string[]
    } else {
      return { success: false, error: 'No chat IDs specified' }
    }

    try {
      const results = await notificationGateway.send({
        type: 'INFO',
        title: context.node.config.title as string || 'Notification',
        message: String(message),
        recipientIds: chatIds,
        channels: ['telegram'],
      })

      return { success: true, output: { [outputVar]: results } }
    } catch (err: any) {
      return { success: false, error: `Telegram notification failed: ${err.message}` }
    }
  },
}
