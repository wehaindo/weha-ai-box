import type { NotificationProvider, NotificationPayload, NotificationResult } from '../types.js'

interface SmsConfig {
  provider: 'twilio' | 'custom'
  apiKey: string
  apiSecret?: string
  fromNumber: string
  apiBaseUrl?: string
}

class SmsProvider implements NotificationProvider {
  name = 'SMS'
  channel = 'sms' as const
  private config: SmsConfig | null = null

  configure(config: SmsConfig) {
    this.config = config
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.apiKey
  }

  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    if (!this.isConfigured()) {
      return payload.recipientIds.map((id) => ({
        id: '',
        type: payload.type,
        channel: 'sms',
        status: 'FAILED' as const,
        recipientId: id,
        error: 'SMS not configured',
      }))
    }

    const results: NotificationResult[] = []

    for (const recipientId of payload.recipientIds) {
      try {
        const smsText = `${payload.title}: ${payload.message}`.slice(0, 160)

        if (this.config!.provider === 'twilio') {
          const accountSid = this.config!.apiKey
          const authToken = this.config!.apiSecret || ''
          const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

          const params = new URLSearchParams({
            To: recipientId,
            From: this.config!.fromNumber,
            Body: smsText,
          })

          const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
              method: 'POST',
              headers: {
                Authorization: `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: params,
            },
          )

          if (response.ok) {
            results.push({
              id: `sms_${Date.now()}`,
              type: payload.type,
              channel: 'sms',
              status: 'SENT',
              recipientId,
              sentAt: new Date().toISOString(),
            })
          } else {
            results.push({
              id: '',
              type: payload.type,
              channel: 'sms',
              status: 'FAILED',
              recipientId,
              error: `SMS provider returned ${response.status}`,
            })
          }
        } else {
          const baseUrl = this.config!.apiBaseUrl || 'https://api.sms-provider.com/send'
          const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.config!.apiKey}`,
            },
            body: JSON.stringify({
              to: recipientId,
              from: this.config!.fromNumber,
              text: smsText,
            }),
          })

          if (response.ok) {
            results.push({
              id: `sms_${Date.now()}`,
              type: payload.type,
              channel: 'sms',
              status: 'SENT',
              recipientId,
              sentAt: new Date().toISOString(),
            })
          } else {
            results.push({
              id: '',
              type: payload.type,
              channel: 'sms',
              status: 'FAILED',
              recipientId,
              error: `SMS provider returned ${response.status}`,
            })
          }
        }
      } catch (err: any) {
        results.push({
          id: '',
          type: payload.type,
          channel: 'sms',
          status: 'FAILED',
          recipientId,
          error: err.message,
        })
      }
    }

    return results
  }
}

export const smsProvider = new SmsProvider()
