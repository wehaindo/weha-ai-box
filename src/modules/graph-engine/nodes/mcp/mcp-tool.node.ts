import { NodeHandler } from '../../node-handler.js'
import { mcpRuntimeService } from '../../../mcp-runtime/mcp-runtime.service.js'

export const mcpToolNode: NodeHandler = {
  type: 'mcp-tool',
  category: 'MCP',

  validate(config) {
    const errors: string[] = []
    if (!config.serverId) errors.push('serverId is required')
    if (!config.toolName) errors.push('toolName is required')
    return errors
  },

  async execute(context) {
    const serverId = context.node.config.serverId as string
    const toolName = context.node.config.toolName as string
    const outputVar = context.node.config.outputVariable as string || '_mcpToolResult'
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
      const result = await mcpRuntimeService.executeTool(serverId, toolName, args)
      return { success: true, output: { [outputVar]: result } }
    } catch (err: any) {
      return { success: false, error: `MCP tool execution failed: ${err.message}` }
    }
  },
}
