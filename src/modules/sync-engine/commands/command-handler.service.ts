import { databaseService } from '../../database/database.service.js'
import { erpAuthService } from '../../erp-connector/erp-auth.service.js'
import { auditService } from '../../audit/audit.service.js'

class CommandHandlerService {
  async restartRuntime() {
    console.log('Restarting runtime (simulated — graceful restart not yet implemented)')
    await auditService.log({
      action: 'RUNTIME_RESTART',
      entityType: 'system',
      metadata: { triggeredBy: 'remote_command' },
    })
    process.exit(0)
  }

  async deployAgent(payload: { agentId?: string; definition?: Record<string, unknown> }) {
    if (!payload.agentId || !payload.definition) {
      throw new Error('deploy_agent requires agentId and definition')
    }

    const db = databaseService.getClient()
    await db.agent.upsert({
      where: { agentId: payload.agentId },
      update: {
        definition: payload.definition,
        version: { increment: 1 },
        deployedAt: new Date(),
        status: 'ACTIVE',
      },
      create: {
        agentId: payload.agentId,
        name: (payload.definition as any)?.agent?.name || payload.agentId,
        definition: payload.definition,
        checksum: '',
        status: 'ACTIVE',
      },
    })

    await auditService.log({
      action: 'AGENT_DEPLOY',
      entityType: 'agent',
      entityId: payload.agentId,
      metadata: { triggeredBy: 'remote_command' },
    })

    console.log(`Agent deployed: ${payload.agentId}`)
  }

  async rollbackAgent(payload: { agentId: string; version: number }) {
    const db = databaseService.getClient()
    const agent = await db.agent.findUnique({ where: { agentId: payload.agentId } })
    if (!agent) throw new Error(`Agent not found: ${payload.agentId}`)

    await db.agent.update({
      where: { agentId: payload.agentId },
      data: { version: payload.version },
    })

    await auditService.log({
      action: 'AGENT_ROLLBACK',
      entityType: 'agent',
      entityId: payload.agentId,
      metadata: { toVersion: payload.version, triggeredBy: 'remote_command' },
    })

    console.log(`Agent ${payload.agentId} rolled back to v${payload.version}`)
  }

  async collectLogs(payload: { since?: string; level?: string; maxLines?: number }): Promise<string> {
    const db = databaseService.getClient()
    const where: Record<string, unknown> = {}
    if (payload.since) where.timestamp = { gte: new Date(payload.since) }
    if (payload.level) where.level = payload.level

    const logs = await db.executionLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: payload.maxLines || 100,
    })

    const formatted = logs
      .map((l) => `[${l.timestamp.toISOString()}] [${l.level}] ${l.message}${l.nodeId ? ` (node: ${l.nodeId})` : ''}`)
      .join('\n')

    if (erpAuthService.isConfigured()) {
      const headers = erpAuthService.getHeaders()
      await fetch(`${erpAuthService.getServerUrl()}/api/device/logs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ logs: formatted, executionId: '' }),
        signal: AbortSignal.timeout(15000),
      }).catch(() => {})
    }

    return formatted
  }

  async updateConfig(payload: Record<string, unknown>) {
    const db = databaseService.getClient()

    for (const [key, value] of Object.entries(payload)) {
      await db.appConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }

    await auditService.log({
      action: 'CONFIG_UPDATE',
      entityType: 'config',
      metadata: { keys: Object.keys(payload), triggeredBy: 'remote_command' },
    })

    console.log(`Config updated: ${Object.keys(payload).join(', ')}`)
  }
}

export const commandHandlerService = new CommandHandlerService()
