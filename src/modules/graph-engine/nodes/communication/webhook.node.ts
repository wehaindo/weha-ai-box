import { NodeHandler } from '../../node-handler.js'

export const webhookNode: NodeHandler = {
  type: 'webhook',
  category: 'COMMUNICATION',

  validate(config) {
    const errors: string[] = []
    if (!config.url && !config.urlExpr) errors.push('url or urlExpr is required')
    return errors
  },

  async execute(context) {
    const outputVar = context.node.config.outputVariable as string || '_webhookResult'

    const url = context.node.config.url
      ? String(context.node.config.url)
      : context.node.config.urlExpr
        ? String(new Function('vars', `"use strict"; return (${context.node.config.urlExpr})`)(context.variables))
        : ''

    if (!url) return { success: false, error: 'Webhook URL is required' }

    const method = (context.node.config.method as string) || 'POST'
    const headersConfig = context.node.config.headers as Record<string, string> || {}
    const bodyExpr = context.node.config.body as Record<string, unknown> | string | undefined

    let body: unknown = {}
    if (bodyExpr) {
      if (typeof bodyExpr === 'string') {
        try {
          const fn = new Function('vars', `"use strict"; return (${bodyExpr})`)
          body = fn(context.variables)
        } catch (err: any) {
          return { success: false, error: `Body expression failed: ${err.message}` }
        }
      } else {
        body = bodyExpr
      }
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headersConfig,
        },
        body: method !== 'GET' ? JSON.stringify(body) : undefined,
      })

      const responseBody = await response.text().catch(() => '')

      return {
        success: true,
        output: {
          [outputVar]: {
            status: response.status,
            ok: response.ok,
            body: responseBody,
          },
        },
      }
    } catch (err: any) {
      return { success: false, error: `Webhook call failed: ${err.message}` }
    }
  },
}
