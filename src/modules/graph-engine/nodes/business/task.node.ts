import { NodeHandler } from '../../node-handler.js'
import { erpClientService } from '../../../erp-connector/erp-client.service.js'
import { erpAuthService } from '../../../erp-connector/erp-auth.service.js'

export const taskNode: NodeHandler = {
  type: 'task',
  category: 'BUSINESS',

  validate(config) {
    const errors: string[] = []
    if (!config.title) errors.push('title is required')
    if (!config.assignee && !config.assigneeExpr) errors.push('assignee or assigneeExpr is required')
    return errors
  },

  async execute(context) {
    if (!erpAuthService.isConfigured()) {
      return { success: false, error: 'ERP not configured.' }
    }

    const title = context.node.config.title as string
    const description = context.node.config.description as string || ''
    const outputVar = context.node.config.outputVariable as string || '_taskResult'
    const priority = context.node.config.priority as string || 'MEDIUM'
    const dueDate = context.node.config.dueDate as string | undefined

    let assignee: string
    const assigneeExpr = context.node.config.assigneeExpr as string | undefined
    if (assigneeExpr) {
      try {
        const fn = new Function('vars', `"use strict"; return (${assigneeExpr})`)
        assignee = String(fn(context.variables))
      } catch (err: any) {
        return { success: false, error: `Assignee expression failed: ${err.message}` }
      }
    } else {
      assignee = context.node.config.assignee as string
    }

    if (!assignee) {
      return { success: false, error: 'No assignee specified' }
    }

    try {
      const result = await erpClientService.create('tasks', {
        title,
        description,
        assigneeId: assignee,
        priority,
        dueDate,
        source: 'AI_BOX',
        sourceId: context.executionId,
      })

      return {
        success: true,
        output: { [outputVar]: result },
      }
    } catch (err: any) {
      return { success: false, error: `Task creation failed: ${err.message}` }
      }
  },
}
