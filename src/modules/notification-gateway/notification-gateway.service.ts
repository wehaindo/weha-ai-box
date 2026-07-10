import type { NotificationPayload, NotificationResult, NotificationChannel, NotificationProvider, ApprovalResponse } from './types.js'
import { channelRouter } from './channel-router.js'
import { notificationQueueService } from './notification-queue.service.js'

class NotificationGatewayService {
  private providers = new Map<NotificationChannel, NotificationProvider>()
  private approvalHandlers: Array<(response: ApprovalResponse) => Promise<void>> = []

  registerProvider(provider: NotificationProvider) {
    this.providers.set(provider.channel, provider)
  }

  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    const channels = channelRouter.resolve(payload)
    const results: NotificationResult[] = []

    for (const channel of channels) {
      const provider = this.providers.get(channel)
      if (!provider) {
        results.push({
          id: `failed_${Date.now()}`,
          type: payload.type,
          channel,
          status: 'FAILED',
          recipientId: payload.recipientIds[0] || '',
          error: `No provider registered for channel: ${channel}`,
        })
        continue
      }

      try {
        const channelResults = await provider.send(payload)
        results.push(...channelResults)
      } catch (err: any) {
        results.push({
          id: `failed_${Date.now()}`,
          type: payload.type,
          channel,
          status: 'FAILED',
          recipientId: payload.recipientIds[0] || '',
          error: err.message,
        })
      }
    }

    return results
  }

  async sendAsync(payload: NotificationPayload): Promise<string> {
    const channels = channelRouter.resolve(payload)
    return notificationQueueService.enqueue(payload, channels)
  }

  async sendToChannel(payload: NotificationPayload, channel: NotificationChannel): Promise<NotificationResult[]> {
    const provider = this.providers.get(channel)
    if (!provider) {
      return [{
        id: `failed_${Date.now()}`,
        type: payload.type,
        channel,
        status: 'FAILED',
        recipientId: payload.recipientIds[0] || '',
        error: `No provider for channel: ${channel}`,
      }]
    }
    return await provider.send(payload)
  }

  async sendApproval(payload: NotificationPayload): Promise<NotificationResult[]> {
    const channels = channelRouter.resolve({ ...payload, type: 'APPROVAL' })
    const results: NotificationResult[] = []

    for (const channel of channels) {
      const provider = this.providers.get(channel)
      if (provider?.sendApproval) {
        try {
          const r = await provider.sendApproval(payload)
          results.push(...r)
        } catch (err: any) {
          results.push({ id: '', type: 'APPROVAL', channel, status: 'FAILED', recipientId: '', error: err.message })
        }
      }
    }

    return results
  }

  onApprovalResponse(handler: (response: ApprovalResponse) => Promise<void>) {
    this.approvalHandlers.push(handler)
  }

  async handleApprovalResponse(response: ApprovalResponse) {
    await Promise.all(this.approvalHandlers.map((h) => h(response)))
  }
}

export const notificationGateway = new NotificationGatewayService()
