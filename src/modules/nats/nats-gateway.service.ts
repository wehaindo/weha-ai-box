import { connect, Msg, NatsConnection, StringCodec } from 'nats'
import { env } from '../../config/env.js'
import { deviceConfigService } from '../device-config/device-config.service.js'
import { conversationService } from '../chat/conversation.service.js'
import { chatService } from '../chat/chat.service.js'
import { commandHandlerService } from '../sync-engine/commands/command-handler.service.js'
import type { NatsDeviceEnvelope, NatsDeviceCommand } from '../../types/gateway.js'

const HEARTBEAT_INTERVAL_MS = 30_000
const RETRY_BASE_MS = 5_000
const RETRY_MAX_MS = 60_000

/**
 * NATS gateway client — connects the AI Box to the WEHA Platform Gateway
 * routing hub so it can receive commands (e.g. `chat_message` from WHOTIF, or
 * device-management commands) and report heartbeats / task results.
 *
 * Uses a core subscription so it can answer request/reply when needed (a
 * JetStream push consumer would rewrite `msg.reply`). This is the box's only
 * gateway transport (the legacy WebSocket client has been removed).
 */
class NatsGatewayService {
  private readonly codec = StringCodec()
  private nc: NatsConnection | null = null
  private unsub: (() => void) | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryDelayMs = RETRY_BASE_MS
  private stopped = false

  async start(): Promise<void> {
    if (!env.NATS_URL) {
      console.warn('[nats] NATS_URL not set — NATS gateway client disabled')
      return
    }
    await this.connect()
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.retryTimer) clearTimeout(this.retryTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.unsub?.()
    this.unsub = null
    if (this.nc) {
      await this.nc.drain().catch(() => undefined)
      this.nc = null
    }
  }

  isConnected(): boolean {
    return !!this.nc
  }

  private async connect(): Promise<void> {
    if (this.stopped) return

    const config = deviceConfigService.get()
    if (!config.tenantId || !config.deviceId) {
      console.warn('[nats] device not registered yet — retrying in 10s')
      this.retryTimer = setTimeout(() => void this.connect(), 10_000)
      return
    }

    try {
      const nc = await connect({
        servers: env.NATS_URL,
        user: env.NATS_USER || undefined,
        pass: env.NATS_PASS || undefined,
        reconnect: true,
        maxReconnectAttempts: -1,
        reconnectDelayHandler: () => 1000,
        timeout: 5000,
      })
      this.nc = nc
      this.retryDelayMs = RETRY_BASE_MS

      this.attachSubscriber(nc, config.tenantId, config.deviceId)
      this.startHeartbeat(config.tenantId, config.deviceId)
      this.sendEvent(config.tenantId, config.deviceId, 'box.online', { boxId: config.deviceId })

      console.log(`[nats] connected; listening on tenant.${config.tenantId}.device.${config.deviceId}.command`)
    } catch (err: any) {
      console.warn(`[nats] connection failed (${err?.message}) — retrying in ${this.retryDelayMs / 1000}s`)
      this.retryTimer = setTimeout(() => void this.connect(), this.retryDelayMs)
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, RETRY_MAX_MS)
    }
  }

  private attachSubscriber(nc: NatsConnection, tenantId: string, deviceId: string): void {
    const subject = `tenant.${tenantId}.device.${deviceId}.command`
    const sub = nc.subscribe(subject)
    this.unsub = () => sub.unsubscribe()
    void (async () => {
      for await (const msg of sub) {
        try {
          await this.handleCommand(msg, tenantId, deviceId)
        } catch (err: any) {
          console.error(`[nats] command handling failed: ${err?.message}`)
        }
      }
    })()
  }

  private async handleCommand(msg: Msg, tenantId: string, deviceId: string): Promise<void> {
    const raw = JSON.parse(this.codec.decode(msg.data)) as NatsDeviceCommand
    // Accept both PlatformCommand (cmdId) and DeviceCommandMessage (id).
    const command: NatsDeviceCommand = {
      id: raw.cmdId ?? raw.id ?? '',
      type: raw.type,
      payload: raw.payload ?? null,
      correlationId: raw.correlationId,
      issuedAt: raw.issuedAt,
    }
    if (!command.id || !command.type) {
      console.warn('[nats] ignoring malformed command')
      return
    }

    if (command.type === 'chat_message') {
      await this.handleChatMessage(command, tenantId, deviceId)
      return
    }

    // Device-management commands
    await this.handleDeviceCommand(command)
  }

  private async handleDeviceCommand(command: NatsDeviceCommand): Promise<void> {
    const payload = (command.payload ?? {}) as any
    switch (command.type) {
      case 'restart_runtime':
        await commandHandlerService.restartRuntime()
        break
      case 'deploy_agent':
        await commandHandlerService.deployAgent(payload)
        break
      case 'rollback_agent':
        await commandHandlerService.rollbackAgent(payload)
        break
      case 'collect_logs':
        await commandHandlerService.collectLogs(payload)
        break
      case 'update_config':
        await commandHandlerService.updateConfig(payload)
        break
      case 'health_check':
        console.log('[nats] health_check command received')
        break
      default:
        console.warn(`[nats] unknown command type: ${command.type}`)
    }
  }

  private async handleChatMessage(command: NatsDeviceCommand, tenantId: string, deviceId: string): Promise<void> {
    const payload = (command.payload ?? {}) as {
      message?: string
      conversationId?: string
      senderId?: string
      senderName?: string
    }
    const message = String(payload.message ?? '').trim()
    if (!message) {
      await this.sendResult(tenantId, deviceId, command, { status: 'error', error: 'chat_message requires a message payload' })
      return
    }

    const externalKey = `whotif:${payload.conversationId ?? payload.senderId ?? 'unknown'}`
    let conversation = await conversationService.getConversationByUserId(externalKey)
    if (!conversation) {
      conversation = await conversationService.createConversation(undefined, externalKey)
    }

    console.log(`[nats] chat_message for ${externalKey} -> box conversation ${conversation.id}`)
    const result = await chatService.sendMessage(conversation.id, message)

    await this.sendResult(tenantId, deviceId, command, {
      status: 'success',
      type: 'chat_reply',
      result: { text: result.assistantMessage.content },
      toolActivity: result.toolActivity,
      model: result.model,
    })
  }

  private async sendResult(
    tenantId: string,
    deviceId: string,
    command: NatsDeviceCommand,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.sendEnvelope(tenantId, deviceId, {
      type: 'TASK_RESULT',
      data: {
        replyTo: 'whotif',
        correlationId: command.correlationId,
        messageId: command.id,
        ...data,
      },
    })
  }

  private startHeartbeat(tenantId: string, deviceId: string): void {
    void this.sendHeartbeat(tenantId, deviceId)
    this.heartbeatTimer = setInterval(() => void this.sendHeartbeat(tenantId, deviceId), HEARTBEAT_INTERVAL_MS)
  }

  private async sendHeartbeat(tenantId: string, deviceId: string): Promise<void> {
    await this.sendEnvelope(tenantId, deviceId, {
      type: 'HEARTBEAT',
      data: {
        status: 'online',
        profile: 'AI_BOX',
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        metrics: { cpu: 0, memory: 0, disk: 0 },
        timestamp: new Date().toISOString(),
      },
    })
  }

  private async sendEvent(tenantId: string, deviceId: string, eventName: string, data: Record<string, unknown>): Promise<void> {
    await this.sendEnvelope(tenantId, deviceId, {
      type: 'EVENT',
      data: { eventName, data, timestamp: new Date().toISOString() },
    })
  }

  private async sendEnvelope(tenantId: string, deviceId: string, envelope: NatsDeviceEnvelope): Promise<void> {
    if (!this.nc) return
    const subject = `tenant.${tenantId}.device.${deviceId}.event`
    try {
      this.nc.publish(subject, this.codec.encode(JSON.stringify({ boxId: deviceId, deviceId, tenantId, ...envelope })))
    } catch (err: any) {
      console.warn(`[nats] publish to ${subject} failed: ${err?.message}`)
    }
  }
}

export const natsGatewayService = new NatsGatewayService()
