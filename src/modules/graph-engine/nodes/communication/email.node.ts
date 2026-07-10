import { NodeHandler } from '../../node-handler.js'
import { notificationGateway } from '../../../notification-gateway/notification-gateway.service.js'

export const emailNode: NodeHandler = {
  type: 'email',
  category: 'COMMUNICATION',

  validate(config) {
    const errors: string[] = []
    if (!config.to && !config.toExpr) errors.push('to or toExpr is required')
    return errors
  },

  async execute(context) {
    const outputVar = context.node.config.outputVariable as string || '_emailResult'

    const subject = context.node.config.subject as string || 'AI Box Notification'
    const body = context.node.config.body
      ? String(context.node.config.body)
      : context.node.config.bodyExpr
        ? new Function('vars', `"use strict"; return String(${context.node.config.bodyExpr})`)(context.variables)
        : ''

    let recipients: string[]
    if (context.node.config.to) {
      recipients = Array.isArray(context.node.config.to) ? context.node.config.to as string[] : [context.node.config.to as string]
    } else if (context.node.config.toExpr) {
      recipients = new Function('vars', `"use strict"; return (${context.node.config.toExpr})`)(context.variables) as string[]
    } else {
      return { success: false, error: 'No recipients specified' }
    }

    try {
      const results = await notificationGateway.send({
        type: 'INFO',
        title: subject,
        message: body,
        recipientIds: recipients,
        channels: ['email'],
      })

      return { success: true, output: { [outputVar]: results } }
    } catch (err: any) {
      return { success: false, error: `Email notification failed: ${err.message}` }
    }
  },
}
