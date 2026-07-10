import type { NotificationProvider, NotificationPayload, NotificationResult } from '../types.js'

interface FirebaseConfig {
  serverKey: string
  fcmUrl?: string
}

class FirebaseProvider implements NotificationProvider {
  name = 'Firebase Cloud Messaging'
  channel = 'firebase' as const
  private config: FirebaseConfig | null = null

  configure(config: FirebaseConfig) {
    this.config = config
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.serverKey
  }

  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    if (!this.isConfigured()) {
      return payload.recipientIds.map((id) => ({
        id: '',
        type: payload.type,
        channel: 'firebase',
        status: 'FAILED' as const,
        recipientId: id,
        error: 'FCM not configured',
      }))
    }

    const fcmUrl = this.config!.fcmUrl || 'https://fcm.googleapis.com/fcm/send'
    const results: NotificationResult[] = []

    for (const recipientId of payload.recipientIds) {
      try {
        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${this.config!.serverKey}`,
          },
          body: JSON.stringify({
            to: recipientId,
            notification: {
              title: payload.title,
              body: payload.message,
              priority: payload.priority === 'URGENT' ? 'high' : 'normal',
            },
            data: {
              type: payload.type,
              ...(payload.metadata as Record<string, string>),
            },
          }),
        })

        if (response.ok) {
          results.push({
            id: `fcm_${Date.now()}`,
            type: payload.type,
            channel: 'firebase',
            status: 'SENT',
            recipientId,
            sentAt: new Date().toISOString(),
          })
        } else {
          results.push({
            id: '',
            type: payload.type,
            channel: 'firebase',
            status: 'FAILED',
            recipientId,
            error: `FCM returned ${response.status}`,
          })
        }
      } catch (err: any) {
        results.push({
          id: '',
          type: payload.type,
          channel: 'firebase',
          status: 'FAILED',
          recipientId,
          error: err.message,
        })
      }
    }

    return results
  }
}

export const firebaseProvider = new FirebaseProvider()
