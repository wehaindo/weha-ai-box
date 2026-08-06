export function formatUpstreamError(status: number, body: string): string {
  let message = body

  try {
    const parsed = JSON.parse(body)
    message = parsed?.error || parsed?.message || parsed?.detail || body
  } catch {
    // body is plain text — use as-is
  }

  const text = typeof message === 'string' ? message : JSON.stringify(message)

  if (/scope/i.test(text)) {
    return `Tool execution requires the mcp:execute scope, which this device token lacks. Ask your ERP administrator to grant the mcp:execute scope to this device, then re-register it at /register. (Server said: ${text})`
  }

  return `Server execution failed (${status}): ${text}`
}
