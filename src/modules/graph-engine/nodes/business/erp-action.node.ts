import { NodeHandler } from '../../node-handler.js'
import { erpClientService } from '../../../erp-connector/erp-client.service.js'
import { erpAuthService } from '../../../erp-connector/erp-auth.service.js'

export const erpActionNode: NodeHandler = {
  type: 'erp-action',
  category: 'BUSINESS',

  validate(config) {
    const errors: string[] = []
    if (!config.endpoint) errors.push('endpoint is required')
    if (!config.method) errors.push('method (create/update/delete/action) is required')
    return errors
  },

  async execute(context) {
    if (!erpAuthService.isConfigured()) {
      return { success: false, error: 'ERP not configured.' }
    }

    const endpoint = context.node.config.endpoint as string
    const method = context.node.config.method as string
    const outputVar = context.node.config.outputVariable as string || '_erpActionResult'
    const idExpr = context.node.config.id as string | undefined
    const bodyExpr = context.node.config.body as Record<string, unknown> | string | undefined

    let id: string | undefined
    if (idExpr) {
      id = context.variables[idExpr] as string || idExpr
    }

    let body: Record<string, unknown> = {}
    if (bodyExpr) {
      if (typeof bodyExpr === 'string') {
        try {
          const fn = new Function('vars', `"use strict"; return (${bodyExpr})`)
          body = fn(context.variables) as Record<string, unknown>
        } catch (err: any) {
          return { success: false, error: `Body expression failed: ${err.message}` }
        }
      } else {
        body = bodyExpr as Record<string, unknown>
      }
    }

    try {
      let result: unknown

      switch (method) {
        case 'create':
          result = await erpClientService.create(endpoint, body)
          break
        case 'update':
          if (!id) return { success: false, error: 'id is required for update method' }
          result = await erpClientService.update(endpoint, id, body)
          break
        case 'delete':
          if (!id) return { success: false, error: 'id is required for delete method' }
          result = await erpClientService.delete(endpoint, id)
          break
        case 'action':
          result = await erpClientService.action(endpoint, body)
          break
        default:
          return { success: false, error: `Unknown method: ${method}` }
      }

      return { success: true, output: { [outputVar]: result } }
    } catch (err: any) {
      return { success: false, error: `ERP action failed: ${err.message}` }
    }
  },
}
