import { NodeHandler } from '../../node-handler.js'
import { notificationGateway } from '../../../notification-gateway/notification-gateway.service.js'

export const whotifNode: NodeHandler = {
  type: 'whotif',
  category: 'COMMUNICATION',

  validate(config) {
    const errors: string[] = []
    if (!config.title) errors.push('title is required')
    if (!config.message && !config.messageExpr) errors.push('message or messageExpr is required')
    if (!config.recipients && !config.recipientExpr) errors.push('recipients or recipientExpr is required')
    return errors
  },

  async execute(context) {
    const title = context.node.config.title as string
    const outputVar = context.node.config.outputVariable as string || '_whotifResult'

    const message = context.node.config.message
      ? String(context.node.config.message)
      : context.node.config.messageExpr
        ? new Function('vars', `"use strict"; return String(${context.node.config.messageExpr})`)(context.variables)
        : ''

    let recipients: string[]
    if (context.node.config.recipients) {
      recipients = context.node.config.recipients as string[]
    } else if (context.node.config.recipientExpr) {
      recipients = new Function('vars', `"use strict"; return (${context.node.config.recipientExpr})`)(context.variables) as string[]
    } else {
      return { success: false, error: 'No recipients specified' }
    }

    try {
      const results = await notificationGateway.send({
        type: (context.node.config.notificationType as any) || 'INFO',
        title,
        message: String(message),
        recipientIds: recipients,
        priority: (context.node.config.priority as any) || 'MEDIUM',
        metadata: context.node.config.includeVariables ? { ...context.variables } : undefined,
        channels: ['whotif'],
      })

      return { success: true, output: { [outputVar]: results } }
    } catch (err: any) {
      return { success: false, error: `WHOTIF notification failed: ${err.message}` }
    }
  },
}
