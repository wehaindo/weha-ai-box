import crypto from 'crypto'
import { erpAuthService } from '../erp-connector/erp-auth.service.js'
import { databaseService } from '../database/database.service.js'
import { parseAgentJson } from '../graph-engine/index.js'

interface HeartbeatPayload {
  deviceId: string
  version: string
  uptime: number
  status: 'online' | 'degraded' | 'offline'
  executions: { active: number; completed: number; failed: number; pending: number }
  plugins: { active: number; total: number }
  system: { cpu: number; memory: number; disk: number }
  timestamp: string
}

interface SyncCommand {
  id: string
  type: string
  payload: Record<string, unknown>
  issuedAt: string
}

class SyncEngineService {
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private syncInterval: ReturnType<typeof setInterval> | null = null
  private mcpSyncInterval: ReturnType<typeof setInterval> | null = null
  private running = false
  private appVersion = '1.0.0'
  private syncStatus = { agents: '', mcp: '', heartbeat: '' }

  configure(version?: string) {
    if (version) this.appVersion = version
  }

  start() {
    if (this.running) return
    this.running = true

    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), 30000)
    this.syncInterval = setInterval(() => this.syncAgents(), 60000)
    this.mcpSyncInterval = setInterval(() => this.syncMcpTools(), 120000)

    this.sendHeartbeat()
    this.syncAgents()
    this.syncMcpTools()

    console.log('Sync engine started (heartbeat: 30s, agent sync: 60s, mcp sync: 120s)')
  }

  stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    if (this.syncInterval) clearInterval(this.syncInterval)
    if (this.mcpSyncInterval) clearInterval(this.mcpSyncInterval)
    this.running = false
    console.log('Sync engine stopped')
  }

  getStatus() {
    return { ...this.syncStatus, running: this.running }
  }

  async triggerAgentSync() {
    await this.syncAgents()
  }

  async triggerMcpSync() {
    await this.syncMcpTools()
  }

  private getBaseUrl(): string {
    return erpAuthService.getServerUrl()
  }

  private async sendHeartbeat() {
    if (!erpAuthService.isConfigured()) {
      console.warn('Heartbeat skipped: ERP not configured')
      return
    }

    try {
      const db = databaseService.getClient()
      const execCounts = await db.execution.groupBy({
        by: ['status'],
        _count: true,
      })

      const counts: Record<string, number> = {}
      for (const e of execCounts) counts[e.status] = e._count

      const pluginCounts = await db.plugin.groupBy({
        by: ['status'],
        _count: true,
      })

      const creds = erpAuthService.getCredentials()
      const payload: HeartbeatPayload = {
        deviceId: creds?.deviceId || '',
        version: this.appVersion,
        uptime: process.uptime(),
        status: 'online',
        executions: {
          active: (counts['RUNNING'] || 0) + (counts['WAITING_APPROVAL'] || 0),
          completed: counts['COMPLETED'] || 0,
          failed: counts['FAILED'] || 0,
          pending: counts['PENDING'] || 0,
        },
        plugins: {
          active: pluginCounts.find((p) => p.status === 'ACTIVE')?._count || 0,
          total: pluginCounts.reduce((sum, p) => sum + p._count, 0),
        },
        system: {
          cpu: process.cpuUsage().user / 1000000,
          memory: process.memoryUsage().rss / 1024 / 1024,
          disk: 0,
        },
        timestamp: new Date().toISOString(),
      }

      const headers = erpAuthService.getHeaders()
      const response = await fetch(`${this.getBaseUrl()}/api/device/v1/ai-box/heartbeat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        this.syncStatus.heartbeat = `failed: ${response.status}`
        return
      }

      const result = await response.json()
      const commands: SyncCommand[] = result?.data?.commands || result?.commands || []

      for (const cmd of commands) {
        await this.handleCommand(cmd).catch((err) =>
          console.error(`Command ${cmd.id} failed:`, err),
        )
      }

      this.syncStatus.heartbeat = `ok ${new Date().toISOString()}`
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.syncStatus.heartbeat = `error: ${err.message}`
      }
    }
  }

  async syncAgents() {
    if (!erpAuthService.isConfigured()) {
      console.warn('Agent sync skipped: ERP not configured')
      return
    }

    try {
      const headers = erpAuthService.getHeaders()
      const response = await fetch(`${this.getBaseUrl()}/api/device/v1/ai-box/agents`, {
        headers,
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        this.syncStatus.agents = `failed: ${response.status}`
        return
      }

      const result = await response.json()
      const agents = result?.data?.agents || result?.agents || []

      console.log(`Agent sync response status: ${response.status}`, JSON.stringify({
        resultKeys: Object.keys(result),
        agentCount: agents.length,
        firstAgentKeys: agents.length > 0 ? Object.keys(agents[0]) : [],
        hasDefinition: agents.length > 0 ? 'definition' in agents[0] : false,
        agentNames: agents.map((a: any) => a.name || a.agent?.name || '(unnamed)'),
      }))

      if (agents.length === 0) {
        this.syncStatus.agents = `ok (0) ${new Date().toISOString()}`
        return
      }

      const db = databaseService.getClient()

      for (const agentData of agents) {
        const inputDef = agentData.definition || agentData
        if (agents.indexOf(agentData) === 0) {
          const content = { ...inputDef }
          delete (content as any).signature
          delete (content as any).checksum
          const sorted: any = {}
          Object.keys(content).sort().forEach((k: string) => { sorted[k] = (content as any)[k] })
          const debugChecksum = crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex')
          console.log('First agent sorted keys:', Object.keys(sorted).join(', '))
          console.log('Settings:', JSON.stringify(sorted.settings))
          console.log('Permissions:', JSON.stringify(sorted.permissions))
          console.log('Metadata:', JSON.stringify(sorted.metadata))
          console.log('Debug checksum:', debugChecksum, 'expected:', inputDef.checksum)
        }
        const parsed = parseAgentJson(inputDef)
        if (!parsed.success) {
          console.warn(`Skipping invalid agent ${agentData.name || agentData.agent?.name}: ${parsed.errors.join('; ')}`, JSON.stringify({
            inputKeys: Object.keys(inputDef),
            hasAgent: 'agent' in inputDef,
            hasNodes: 'nodes' in inputDef,
            hasEdges: 'edges' in inputDef,
          }))
          continue
        }

        await db.agent.upsert({
          where: { agentId: parsed.agent.agent.id },
          update: {
            name: parsed.agent.agent.name,
            description: parsed.agent.agent.description,
            version: parsed.agent.version,
            definition: parsed.agent as unknown as Record<string, unknown>,
            checksum: parsed.agent.checksum,
            signature: parsed.agent.signature,
            status: 'ACTIVE',
            isActive: true,
            deployedAt: new Date(),
          },
          create: {
            agentId: parsed.agent.agent.id,
            name: parsed.agent.agent.name,
            description: parsed.agent.agent.description,
            version: parsed.agent.version,
            definition: parsed.agent as unknown as Record<string, unknown>,
            checksum: parsed.agent.checksum,
            signature: parsed.agent.signature,
            status: 'ACTIVE',
          },
        })

        console.log(`Synced agent: ${parsed.agent.agent.name} v${parsed.agent.version}`)
      }

      this.syncStatus.agents = `ok (${agents.length}) ${new Date().toISOString()}`
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.syncStatus.agents = `error: ${err.message}`
      }
    }
  }

  async syncMcpTools() {
    if (!erpAuthService.isConfigured()) {
      console.warn('MCP sync skipped: ERP not configured')
      return
    }

    try {
      const headers = erpAuthService.getHeaders()
      const response = await fetch(`${this.getBaseUrl()}/api/device/v1/ai-box/mcp-tools`, {
        headers,
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        this.syncStatus.mcp = `failed: ${response.status}`
        return
      }

      const result = await response.json()
      const tools = result?.data?.tools || result?.tools || []

      if (tools.length === 0) {
        this.syncStatus.mcp = `ok (0) ${new Date().toISOString()}`
        return
      }

      const db = databaseService.getClient()
      let synced = 0

      for (const toolData of tools) {
        const code = toolData.name || toolData.metadata?.code
        if (!code) continue

        const existing = await db.mcpTool.findFirst({
          where: { name: code },
        })

        if (existing) {
          await db.mcpTool.update({
            where: { id: existing.id },
            data: {
              description: toolData.description,
              schema: toolData.inputSchema || {},
              version: toolData.metadata?.version || existing.version,
            },
          })
        } else {
          await db.mcpTool.create({
            data: {
              name: code,
              description: toolData.description || '',
              schema: toolData.inputSchema || {},
              executionType: toolData.executionType || 'builtin',
            },
          })
        }
        synced++
      }

      this.syncStatus.mcp = `ok (${synced}) ${new Date().toISOString()}`
      console.log(`Synced ${synced} MCP tools`)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        this.syncStatus.mcp = `error: ${err.message}`
      }
    }
  }

  private async handleCommand(cmd: SyncCommand) {
    console.log(`Executing remote command: ${cmd.type} (${cmd.id})`)

    const { commandHandlerService } = await import('./commands/command-handler.service.js')

    switch (cmd.type) {
      case 'restart_runtime':
        await commandHandlerService.restartRuntime()
        break
      case 'deploy_agent':
        await commandHandlerService.deployAgent(cmd.payload as any)
        break
      case 'rollback_agent':
        await commandHandlerService.rollbackAgent(cmd.payload as any)
        break
      case 'collect_logs':
        await commandHandlerService.collectLogs(cmd.payload as any)
        break
      case 'update_config':
        await commandHandlerService.updateConfig(cmd.payload as any)
        break
      case 'health_check':
        break
      default:
        console.warn(`Unknown command type: ${cmd.type}`)
    }
  }
}

export const syncEngineService = new SyncEngineService()
