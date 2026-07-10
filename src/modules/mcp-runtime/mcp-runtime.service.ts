import { databaseService } from '../database/database.service.js'
import { credentialVault } from './credential-vault.js'
import { CircuitBreaker } from './circuit-breaker.js'

interface McpToolDefinition {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

interface McpServerConnection {
  id: string
  name: string
  url: string
  headers: Record<string, string>
  breaker: CircuitBreaker
}

class McpRuntimeService {
  private servers = new Map<string, McpServerConnection>()

  async loadServers() {
    const db = databaseService.getClient()
    const records = await db.mcpServer.findMany({
      where: { status: 'CONNECTED' },
      include: { tools: true },
    })

    for (const record of records) {
      const config = record.config as Record<string, unknown> || {}
      const headers: Record<string, string> = {}

      if (config.authType === 'bearer' && config.credentialId) {
        const token = await credentialVault.retrieve(config.credentialId as string)
        if (token) headers['Authorization'] = `Bearer ${token}`
      }
      if (config.authType === 'api-key' && config.credentialId) {
        const key = await credentialVault.retrieve(config.credentialId as string)
        if (key && config.apiKeyHeader) headers[config.apiKeyHeader as string] = key
      }

      const breaker = new CircuitBreaker()
      if (config.failureThreshold) breaker.configure({ failureThreshold: config.failureThreshold as number })
      if (config.cooldownMs) breaker.configure({ cooldownMs: config.cooldownMs as number })

      this.servers.set(record.id, {
        id: record.id,
        name: record.name,
        url: record.url.replace(/\/$/, ''),
        headers,
        breaker,
      })
    }

    console.log(`Loaded ${this.servers.size} MCP servers`)
  }

  async discoverTools(serverId: string): Promise<McpToolDefinition[]> {
    const server = this.servers.get(serverId)
    if (!server) throw new Error(`MCP server not found: ${serverId}`)

    return await server.breaker.call(async () => {
      const response = await fetch(`${server.url}/tools`, { headers: server.headers })
      if (!response.ok) throw new Error(`Failed to discover tools: ${response.status}`)

      const result = await response.json()
      const tools = result?.tools || result?.data || []
      await this.saveTools(serverId, tools)
      return tools as McpToolDefinition[]
    })
  }

  private async saveTools(serverId: string, tools: McpToolDefinition[]) {
    try {
      const db = databaseService.getClient()

      for (const tool of tools) {
        await db.mcpTool.upsert({
          where: { serverId_name: { serverId, name: tool.name } },
          update: {
            description: tool.description,
            schema: tool.inputSchema as Record<string, unknown>,
          },
          create: {
            serverId,
            name: tool.name,
            description: tool.description,
            schema: tool.inputSchema as Record<string, unknown>,
          },
        })
      }
    } catch {
      // Non-critical
    }
  }

  async executeTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const server = this.servers.get(serverId)
    if (!server) throw new Error(`MCP server not found: ${serverId}`)

    return await server.breaker.call(async () => {
      const response = await fetch(`${server.url}/tools/${toolName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...server.headers,
        },
        body: JSON.stringify(args),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`MCP tool execution failed: ${response.status} — ${body}`)
      }

      return await response.json()
    })
  }

  async executeWorkflow(serverId: string, workflowName: string, args: Record<string, unknown>): Promise<unknown> {
    const server = this.servers.get(serverId)
    if (!server) throw new Error(`MCP server not found: ${serverId}`)

    return await server.breaker.call(async () => {
      const response = await fetch(`${server.url}/workflows/${workflowName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...server.headers,
        },
        body: JSON.stringify(args),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`MCP workflow execution failed: ${response.status} — ${body}`)
      }

      return await response.json()
    })
  }

  async checkHealth(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId)
    if (!server) return false

    try {
      const response = await fetch(`${server.url}/health`, {
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}
    for (const [id] of this.servers) {
      results[id] = await this.checkHealth(id)
    }
    return results
  }

  async registerServer(params: {
    name: string
    url: string
    description?: string
    config?: Record<string, unknown>
  }): Promise<string> {
    const db = databaseService.getClient()
    const record = await db.mcpServer.create({
      data: {
        name: params.name,
        url: params.url,
        description: params.description,
        config: params.config || {},
      },
    })

    const headers: Record<string, string> = {}
    this.servers.set(record.id, {
      id: record.id,
      name: record.name,
      url: record.url.replace(/\/$/, ''),
      headers,
      breaker: new CircuitBreaker(),
    })

    return record.id
  }
}

export const mcpRuntimeService = new McpRuntimeService()
