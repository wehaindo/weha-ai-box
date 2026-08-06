import { databaseService } from '../database/database.service.js'

export interface LocalToolHandler {
  name: string
  description: string
  handler: (args: Record<string, unknown>, context: { variables: Record<string, unknown> }) => Promise<unknown>
}

class LocalToolRegistry {
  private handlers = new Map<string, LocalToolHandler>()

  register(code: string, handler: LocalToolHandler) {
    this.handlers.set(code, handler)
  }

  getHandler(code: string): LocalToolHandler | undefined {
    return this.handlers.get(code)
  }

  getAll(): { code: string; handler: LocalToolHandler }[] {
    return Array.from(this.handlers.entries()).map(([code, handler]) => ({ code, handler }))
  }

  has(code: string): boolean {
    return this.handlers.has(code)
  }
}

export const localToolRegistry = new LocalToolRegistry()

function fillTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key]
    return val !== undefined ? String(val) : `{{${key}}}`
  })
}

function interpolateArgs(
  args: Record<string, unknown>,
  vars: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.includes('{{')) {
      result[key] = fillTemplate(value, vars)
    } else {
      result[key] = value
    }
  }
  return result
}

// --- Built-in tool handlers ---

function registerBuiltinTools() {
  // 1. echo — test tool, returns input params
  localToolRegistry.register('echo', {
    name: 'Echo',
    description: 'Returns the input parameters back. Useful for testing.',
    handler: async (args) => ({ received: args, timestamp: new Date().toISOString() }),
  })

  // 2. http-request — generic HTTP fetch
  localToolRegistry.register('http-request', {
    name: 'HTTP Request',
    description: 'Make an HTTP request to a URL. Args: url, method, headers, body',
    handler: async (args) => {
      const url = args.url as string
      if (!url) throw new Error('http-request requires a "url" parameter')

      const response = await fetch(url, {
        method: (args.method as string) || 'GET',
        headers: (args.headers as Record<string, string>) || { 'Content-Type': 'application/json' },
        body: args.body ? JSON.stringify(args.body) : undefined,
        signal: AbortSignal.timeout((args.timeout as number) || 15000),
      })

      const text = await response.text()
      let data: unknown = text
      try { data = JSON.parse(text) } catch { /* keep raw text */ }

      return {
        status: response.status,
        ok: response.ok,
        data,
      }
    },
  })

  // 3. database-query — SELECT-only SQL on local DB
  localToolRegistry.register('database-query', {
    name: 'Database Query',
    description: 'Execute a read-only SQL query on the local database. Args: query, params',
    handler: async (args) => {
      const query = args.query as string
      if (!query) throw new Error('database-query requires a "query" parameter')

      const trimmed = query.trim().toUpperCase()
      if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
        throw new Error('Only SELECT queries are allowed')
      }

      const db = databaseService.getClient()
      const result = await db.$queryRawUnsafe(query, ...((args.params as any[]) || []))
      return { rows: result, rowCount: Array.isArray(result) ? result.length : 0 }
    },
  })

  // 4. date-time — current date/time
  localToolRegistry.register('date-time', {
    name: 'Date Time',
    description: 'Get current date/time. Args: format (iso|unix|date|time|full), timezone, offset',
    handler: async (args) => {
      const now = new Date()
      const format = (args.format as string) || 'full'
      const timezone = args.timezone as string | undefined

      const formatMap: Record<string, string> = {
        iso: now.toISOString(),
        unix: String(Math.floor(now.getTime() / 1000)),
        date: now.toLocaleDateString('en-CA'),
        time: now.toLocaleTimeString('en-US', { hour12: false }),
        full: now.toLocaleString('en-US', { timeZone: timezone, hour12: false }),
      }

      return {
        now: formatMap[format] || formatMap.full,
        format,
        timezone: timezone || 'UTC',
        timestamp: now.getTime(),
        iso: now.toISOString(),
      }
    },
  })

  // 5. calculator — safe arithmetic
  localToolRegistry.register('calculator', {
    name: 'Calculator',
    description: 'Evaluate a math expression. Args: expression',
    handler: async (args) => {
      const expression = args.expression as string
      if (!expression) throw new Error('calculator requires an "expression" parameter')

      // Safe eval — only allows numbers and basic operators
      const sanitized = expression.replace(/\s/g, '')
      if (!/^[\d+\-*/().%^,]+$/.test(sanitized)) {
        throw new Error('Expression contains disallowed characters')
      }

      try {
        const fn = new Function(`"use strict"; return (${expression})`)
        const result = fn()
        return { expression, result, type: typeof result }
      } catch (err: any) {
        throw new Error(`Calculator error: ${err.message}`)
      }
    },
  })

  // 6. json-transform — parse/stringify/merge JSON
  localToolRegistry.register('json-transform', {
    name: 'JSON Transform',
    description: 'Parse, stringify, or merge JSON data. Args: operation (parse|stringify|merge), value',
    handler: async (args) => {
      const operation = args.operation as string
      const value = args.value

      switch (operation) {
        case 'parse': {
          const str = typeof value === 'string' ? value : JSON.stringify(value)
          return { result: JSON.parse(str) }
        }
        case 'stringify': {
          const pretty = args.pretty !== false
          return { result: JSON.stringify(value, null, pretty ? 2 : undefined) }
        }
        case 'merge': {
          const sources = args.sources as Record<string, unknown>[]
          if (!Array.isArray(sources)) throw new Error('merge requires "sources" array')
          const merged = Object.assign({}, ...sources)
          return { result: merged }
        }
        default:
          throw new Error(`Unknown operation: ${operation}. Use parse, stringify, or merge`)
      }
    },
  })

  // 7. knowledge-search — search across local mcpTool definitions
  localToolRegistry.register('knowledge-search', {
    name: 'Knowledge Search',
    description: 'Search across synced MCP tool definitions. Args: query, maxResults',
    handler: async (args) => {
      const query = args.query as string
      if (!query) throw new Error('knowledge-search requires a "query" parameter')
      const maxResults = (args.maxResults as number) || 10

      const db = databaseService.getClient()
      const tools = await db.mcpTool.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { code: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: maxResults,
        select: {
          code: true,
          name: true,
          description: true,
          executionType: true,
          inputSchema: true,
        },
      })

      return {
        query,
        results: tools,
        resultCount: tools.length,
      }
    },
  })

  console.log(`Registered ${localToolRegistry.getAll().length} local MCP tool handlers`)
}

registerBuiltinTools()
