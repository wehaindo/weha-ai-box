import type { NotificationPayload, NotificationResult, NotificationChannel } from './types.js'
import { notificationGateway } from './notification-gateway.service.js'

interface QueuedNotification {
  id: string
  payload: NotificationPayload
  channels: NotificationChannel[]
  createdAt: Date
  retries: number
  maxRetries: number
}

class NotificationQueueService {
  private queue: QueuedNotification[] = []
  private processing = false
  private maxConcurrent = 5

  enqueue(payload: NotificationPayload, channels: NotificationChannel[]) {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.queue.push({
      id,
      payload,
      channels,
      createdAt: new Date(),
      retries: 0,
      maxRetries: 3,
    })
    this.process()
    return id
  }

  private async process() {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0 && this.getActiveCount() < this.maxConcurrent) {
      const item = this.queue.shift()
      if (!item) continue

      this.deliver(item).catch((err) => {
        console.error(`Notification ${item.id} failed:`, err)
        if (item.retries < item.maxRetries) {
          item.retries++
          this.queue.push(item)
        }
      })
    }

    this.processing = false
  }

  private async deliver(item: QueuedNotification): Promise<void> {
    for (const channel of item.channels) {
      try {
        await notificationGateway.sendToChannel(item.payload, channel)
      } catch (err) {
        console.warn(`Channel ${channel} delivery failed:`, err)
      }
    }
  }

  private getActiveCount(): number {
    return this.queue.length
  }

  getQueueLength(): number {
    return this.queue.length
  }
}

export const notificationQueueService = new NotificationQueueService()
