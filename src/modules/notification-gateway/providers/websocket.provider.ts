import type { NotificationProvider, NotificationPayload, NotificationResult } from '../types.js'

class WebSocketProvider implements NotificationProvider {
  name = 'WebSocket'
  channel = 'websocket' as const
  private clients = new Map<string, Set<{ send: (data: string) => void }>>()

  registerClient(userId: string, client: { send: (data: string) => void }) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set())
    }
    this.clients.get(userId)!.add(client)
  }

  unregisterClient(userId: string, client: { send: (data: string) => void }) {
    this.clients.get(userId)?.delete(client)
    if (this.clients.get(userId)?.size === 0) {
      this.clients.delete(userId)
    }
  }

  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = []

    for (const recipientId of payload.recipientIds) {
      const clients = this.clients.get(recipientId)
      if (!clients || clients.size === 0) {
        results.push({
          id: '',
          type: payload.type,
          channel: 'websocket',
          status: 'FAILED',
          recipientId,
          error: 'No active WebSocket connection',
        })
        continue
      }

      const message = JSON.stringify({
        type: 'notification',
        payload: {
          id: `ws_${Date.now()}`,
          ...payload,
        },
        timestamp: new Date().toISOString(),
      })

      for (const client of clients) {
        try {
          client.send(message)
        } catch {
          // Client disconnected
        }
      }

      results.push({
        id: `ws_${Date.now()}`,
        type: payload.type,
        channel: 'websocket',
        status: 'SENT',
        recipientId,
        sentAt: new Date().toISOString(),
      })
    }

    return results
  }
}

export const websocketProvider = new WebSocketProvider()
