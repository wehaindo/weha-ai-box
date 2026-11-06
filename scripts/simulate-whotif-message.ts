/**
 * simulate-whotif-message.ts
 *
 * Option A — simulate a WHOTIF message: create a chat conversation on the AI Box
 * runtime, send a text message, and wait for the assistant reply (which runs the
 * requested agent via the box LLM).
 *
 * Usage:
 *   npx tsx scripts/simulate-whotif-message.ts [message] [--runtime URL]
 *
 * Examples:
 *   npx tsx scripts/simulate-whotif-message.ts "Please run the stock reorder agent"
 *   npx tsx scripts/simulate-whotif-message.ts "run the daily sales report agent"
 */

const RUNTIME_URL = (process.env.RUNTIME_URL || 'http://localhost:4000').replace(/\/$/, '')

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

async function request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const options: RequestInit = { method }
  if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(body)
  }
  const res = await fetch(`${RUNTIME_URL}${path}`, options)
  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${await res.text()}`)
  }
  return (await res.json()) as T
}

async function main() {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const runtime = arg('runtime')
  const baseUrl = (runtime || RUNTIME_URL).replace(/\/$/, '')
  const message = positional[0] || 'Please run the stock reorder agent'

  console.log(`\nWEHA AI Box — Simulate WHOTIF Message`)
  console.log(`Runtime: ${baseUrl}`)
  console.log(`Message: "${message}"\n`)

  console.log('1. Creating conversation...')
  const created = await request<any>('POST', '/api/chat/conversations', {})
  const conversationId = created?.data?.id
  if (!conversationId) throw new Error('No conversation id returned')
  console.log(`   → conversation ${conversationId}\n`)

  console.log('2. Sending message (waiting for the agent to run)...')
  const start = Date.now()
  const result = await request<any>('POST', `/api/chat/conversations/${conversationId}/messages`, {
    content: message,
  })
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  const assistant = result?.data?.assistantMessage
  const toolActivity = result?.data?.toolActivity || []

  console.log(`   → reply received in ${elapsed}s\n`)

  if (toolActivity.length > 0) {
    console.log('Tool activity:')
    for (const t of toolActivity) {
      console.log(`   - ${t.name} [${t.status}] ${t.summary || ''}${t.durationMs ? ` (${t.durationMs}ms)` : ''}`)
    }
    console.log('')
  }

  if (assistant?.content) {
    console.log('Assistant reply:')
    console.log('----------------------------------------')
    console.log(assistant.content)
    console.log('----------------------------------------')
  } else {
    console.log('No assistant reply content returned.')
  }

  console.log(`\nConversation: ${baseUrl}/dashboard/chat`)
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`)
  console.error('Make sure the AI Box runtime is running (npm run dev) on port 4000.')
  process.exit(1)
})
