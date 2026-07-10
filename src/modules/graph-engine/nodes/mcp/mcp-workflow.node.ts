import { NodeHandler } from '../../node-handler.js'
import { mcpRuntimeService } from '../../../mcp-runtime/mcp-runtime.service.js'

export const mcpWorkflowNode: NodeHandler = {
  type: 'mcp-workflow',
  category: 'MCP',

  validate(config) {
    const errors: string[] = []
    if (!config.serverId) errors.push('serverId is required')
    if (!config.workflowName) errors.push('workflowName is required')
    return errors
  },

  async execute(context) {
    const serverId = context.node.config.serverId as string
    const workflowName = context.node.config.workflowName as string
    const outputVar = context.node.config.outputVariable as string || '_mcpWorkflowResult'
    const argsExpr = context.node.config.arguments as Record<string, unknown> | string | undefined

    let args: Record<string, unknown> = {}
    if (argsExpr) {
      if (typeof argsExpr === 'string') {
        try {
          const fn = new Function('vars', `"use strict"; return (${argsExpr})`)
          args = fn(context.variables) as Record<string, unknown>
        } catch (err: any) {
          return { success: false, error: `Arguments expression failed: ${err.message}` }
        }
      } else {
        args = argsExpr as Record<string, unknown>
      }
    }

    try {
      const result = await mcpRuntimeService.executeWorkflow(serverId, workflowName, args)
      return { success: true, output: { [outputVar]: result } }
    } catch (err: any) {
      return { success: false, error: `MCP workflow execution failed: ${err.message}` }
    }
  },
}
