import type { NodeHandler } from '../../node-handler.js'
import { mcpRuntimeService } from '../../../mcp-runtime/mcp-runtime.service.js'
import { localToolRegistry } from '../../../mcp-runtime/local-tool-registry.js'
import { databaseService } from '../../../database/database.service.js'
import { erpAuthService } from '../../../erp-connector/erp-auth.service.js'
import { formatUpstreamError } from '../../../erp-connector/erp-error.js'

export const mcpToolNode: NodeHandler = {
  type: 'mcp-tool',
  category: 'MCP',

  validate(config) {
    const errors: string[] = []
    const mcpConfig = (config as any).mcp_tool || {}
    const hasToolCode = !!(config.toolCode || mcpConfig.toolCode)
    const hasServerTool = !!(config.serverId || mcpConfig.serverId) && !!(config.toolName || mcpConfig.toolName)
    if (!hasToolCode && !hasServerTool) {
      errors.push('Either toolCode (local) or serverId + toolName (external) is required')
    }
    return errors
  },

  async execute(context) {
    const config = context.node.config
    const mcpConfig = (config as any).mcp_tool || {}
    const toolCode = (config.toolCode || mcpConfig.toolCode) as string | undefined
    const serverId = (config.serverId || mcpConfig.serverId) as string | undefined
    const toolName = (config.toolName || mcpConfig.toolName) as string | undefined
    const outputVar = (config.outputVariable as string) || '_mcpToolResult'

    let args: Record<string, unknown> = {}
    const argsExpr = config.arguments as Record<string, unknown> | string | undefined
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

    const resolvedArgs = interpolateArgs(args, context.variables)
    const startTime = Date.now()

    try {
      // Path 1: Local tool execution by toolCode
      if (toolCode) {
        const localHandler = localToolRegistry.getHandler(toolCode)
        if (localHandler) {
          const result = await localHandler.handler(resolvedArgs, { variables: context.variables })
          await recordToolExecution(toolCode, resolvedArgs, result, 'COMPLETED', Date.now() - startTime)
          return { success: true, output: { [outputVar]: result } }
        }

        // Look up synced tool in DB — maybe it has a serverId now
        const db = databaseService.getClient()
        const tool = await db.mcpTool.findFirst({
          where: { OR: [{ code: toolCode }, { name: toolCode }], status: 'ACTIVE' },
          include: { server: true },
        })

        if (tool && tool.serverId && tool.server?.status === 'CONNECTED') {
          const result = await mcpRuntimeService.executeTool(tool.serverId, tool.name, resolvedArgs)
          await recordToolExecution(toolCode, resolvedArgs, result, 'COMPLETED', Date.now() - startTime)
          return { success: true, output: { [outputVar]: result } }
        }

        // Path 3: Proxy execution back to the server
        if (erpAuthService.isConfigured()) {
          const serverUrl = erpAuthService.getServerUrl()
          const headers = erpAuthService.getHeaders()
          const response = await fetch(`${serverUrl.replace(/\/$/, '')}/api/device/v1/ai-box/mcp-tools/execute`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: toolCode, params: resolvedArgs }),
            signal: AbortSignal.timeout(30000),
          })
          if (response.ok) {
            const json = await response.json()
            await recordToolExecution(toolCode, resolvedArgs, json.data, 'COMPLETED', Date.now() - startTime)
            return { success: true, output: { [outputVar]: json.data } }
          }
          const errBody = await response.text().catch(() => '')
          throw new Error(formatUpstreamError(response.status, errBody))
        }

        return {
          success: false,
          error: `No local handler registered for tool code "${toolCode}" and no active MCP server found`,
        }
      }

      // Path 2: External MCP server execution
      if (serverId && toolName) {
        const result = await mcpRuntimeService.executeTool(serverId, toolName, resolvedArgs)
        await recordToolExecution(toolName, resolvedArgs, result, 'COMPLETED', Date.now() - startTime)
        return { success: true, output: { [outputVar]: result } }
      }

      return { success: false, error: 'No toolCode or serverId+toolName provided' }
    } catch (err: any) {
      await recordToolExecution(toolCode || toolName || 'unknown', resolvedArgs, null, 'FAILED', Date.now() - startTime, err.message)
      return { success: false, error: `MCP tool execution failed: ${err.message}` }
    }
  },
}

function interpolateArgs(
  args: Record<string, unknown>,
  vars: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.includes('{{')) {
      result[key] = value.replace(/\{\{(\w+)\}\}/g, (_, k) => {
        const val = vars[k]
        return val !== undefined ? String(val) : `{{${k}}}`
      })
    } else {
      result[key] = value
    }
  }
  return result
}

async function recordToolExecution(
  toolCode: string,
  input: Record<string, unknown>,
  output: unknown,
  status: string,
  duration: number,
  error?: string,
) {
  try {
    const db = databaseService.getClient()
    const tool = await db.mcpTool.findFirst({ where: { code: toolCode } })
    if (tool) {
      await db.toolExecution.create({
        data: {
          toolId: tool.id,
          status: status as any,
          input,
          output: output as any,
          error: error || null,
          duration,
          startedAt: new Date(Date.now() - duration),
          completedAt: new Date(),
        },
      })
    }
  } catch {
    // non-critical
  }
}
