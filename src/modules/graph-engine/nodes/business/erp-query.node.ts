import { NodeHandler } from '../../node-handler.js'
import { erpClientService } from '../../../erp-connector/erp-client.service.js'
import { erpAuthService } from '../../../erp-connector/erp-auth.service.js'

export const erpQueryNode: NodeHandler = {
  type: 'erp-query',
  category: 'BUSINESS',

  validate(config) {
    const errors: string[] = []
    if (!config.endpoint) errors.push('endpoint is required (e.g., "sales-orders")')
    return errors
  },

  async execute(context) {
    if (!erpAuthService.isConfigured()) {
      return { success: false, error: 'ERP not configured. Configure ERP credentials first.' }
    }

    const endpoint = context.node.config.endpoint as string
    const outputVar = context.node.config.outputVariable as string || '_erpQueryResult'
    const filterExpr = context.node.config.filter as string | undefined
    const page = (context.node.config.page as number) || 1
    const limit = (context.node.config.limit as number) || 20

    let filter: Record<string, unknown> | undefined
    if (filterExpr) {
      try {
        const fn = new Function('vars', `"use strict"; return (${filterExpr})`)
        filter = fn(context.variables) as Record<string, unknown>
      } catch (err: any) {
        return { success: false, error: `Filter expression failed: ${err.message}` }
      }
    }

    try {
      const result = await erpClientService.query(endpoint, { filter, page, limit })
      return {
        success: true,
        output: { [outputVar]: result.data, [`${outputVar}_meta`]: { total: result.total, page: result.page, limit: result.limit } },
      }
    } catch (err: any) {
      return { success: false, error: `ERP query failed: ${err.message}` }
    }
  },
}
