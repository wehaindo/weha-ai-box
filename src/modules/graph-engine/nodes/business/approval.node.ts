import { NodeHandler } from '../../node-handler.js'
import { erpClientService } from '../../../erp-connector/erp-client.service.js'
import { erpAuthService } from '../../../erp-connector/erp-auth.service.js'

export const approvalNode: NodeHandler = {
  type: 'approval',
  category: 'BUSINESS',

  validate(config) {
    const errors: string[] = []
    if (!config.approvers && !config.approverExpr) errors.push('approvers or approverExpr is required')
    if (!config.title) errors.push('title is required')
    return errors
  },

  async execute(context) {
    if (!erpAuthService.isConfigured()) {
      return { success: false, error: 'ERP not configured.' }
    }

    const title = context.node.config.title as string
    const description = context.node.config.description as string || ''
    const outputVar = context.node.config.outputVariable as string || '_approvalResult'
    const channel = context.node.config.channel as string || 'whotif'

    let approvers: string[]
    const approverExpr = context.node.config.approverExpr as string | undefined
    if (approverExpr) {
      try {
        const fn = new Function('vars', `"use strict"; return (${approverExpr})`)
        approvers = fn(context.variables) as string[]
      } catch (err: any) {
        return { success: false, error: `Approver expression failed: ${err.message}` }
      }
    } else {
      approvers = context.node.config.approvers as string[]
    }

    if (!Array.isArray(approvers) || approvers.length === 0) {
      return { success: false, error: 'No approvers specified' }
    }

    try {
      const result = await erpClientService.action('approvals', {
        title,
        description,
        approvers,
        channel,
        context: {
          executionId: context.executionId,
          agentId: context.agentId,
          variables: context.variables,
        },
      })

      const approvalId = (result as any)?.data?.id || (result as any)?.id

      return {
        success: true,
        output: { [outputVar]: { approvalId, ...(result as any)?.data || result } },
        pauseForApproval: true,
      }
    } catch (err: any) {
      return { success: false, error: `Approval request failed: ${err.message}` }
    }
  },
}
