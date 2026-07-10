import { NodeHandler } from '../../node-handler.js'
import { erpClientService } from '../../../erp-connector/erp-client.service.js'
import { erpAuthService } from '../../../erp-connector/erp-auth.service.js'

export const workflowActionNode: NodeHandler = {
  type: 'workflow-action',
  category: 'BUSINESS',

  validate(config) {
    const errors: string[] = []
    if (!config.workflowId) errors.push('workflowId is required')
    return errors
  },

  async execute(context) {
    if (!erpAuthService.isConfigured()) {
      return { success: false, error: 'ERP not configured.' }
    }

    const workflowId = context.node.config.workflowId as string
    const outputVar = context.node.config.outputVariable as string || '_workflowResult'
    const waitForCompletion = context.node.config.waitForCompletion !== false
    const paramsExpr = context.node.config.parameters as Record<string, unknown> | string | undefined

    let parameters: Record<string, unknown> = {}
    if (paramsExpr) {
      if (typeof paramsExpr === 'string') {
        try {
          const fn = new Function('vars', `"use strict"; return (${paramsExpr})`)
          parameters = fn(context.variables) as Record<string, unknown>
        } catch (err: any) {
          return { success: false, error: `Parameters expression failed: ${err.message}` }
        }
      } else {
        parameters = paramsExpr as Record<string, unknown>
      }
    }

    try {
      const result = await erpClientService.action(`workflows/${workflowId}/trigger`, parameters)

      if (waitForCompletion) {
        const executionId = (result as any)?.data?.id || (result as any)?.id
        if (executionId) {
          const finalResult = await erpClientService.waitForApproval(executionId, 3000, 600000)
          return { success: true, output: { [outputVar]: finalResult } }
        }
      }

      return { success: true, output: { [outputVar]: result } }
    } catch (err: any) {
      return { success: false, error: `Workflow trigger failed: ${err.message}` }
    }
  },
}
