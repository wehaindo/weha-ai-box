import type { NotificationProvider, NotificationPayload, NotificationResult } from '../types.js'

interface EmailConfig {
  smtpHost: string
  smtpPort: number
  username: string
  password: string
  fromAddress: string
  fromName?: string
}

class EmailProvider implements NotificationProvider {
  name = 'Email'
  channel = 'email' as const
  private config: EmailConfig | null = null

  configure(config: EmailConfig) {
    this.config = config
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.smtpHost
  }

  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    if (!this.isConfigured()) {
      return payload.recipientIds.map((id) => ({
        id: '',
        type: payload.type,
        channel: 'email',
        status: 'FAILED' as const,
        recipientId: id,
        error: 'SMTP not configured',
      }))
    }

    const results: NotificationResult[] = []

    for (const recipientId of payload.recipientIds) {
      try {
        const htmlBody = this.buildHtml(payload)
        const textBody = `${payload.title}\n\n${payload.message}`

        const response = await fetch(`http://localhost:4025/api/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipientId,
            from: this.config!.fromAddress,
            subject: payload.title,
            text: textBody,
            html: htmlBody,
          }),
        })

        if (response.ok) {
          results.push({
            id: `email_${Date.now()}`,
            type: payload.type,
            channel: 'email',
            status: 'SENT',
            recipientId,
            sentAt: new Date().toISOString(),
          })
        } else {
          results.push({
            id: '',
            type: payload.type,
            channel: 'email',
            status: 'FAILED',
            recipientId,
            error: `Email service returned ${response.status}`,
          })
        }
      } catch (err: any) {
        results.push({
          id: '',
          type: payload.type,
          channel: 'email',
          status: 'FAILED',
          recipientId,
          error: err.message,
        })
      }
    }

    return results
  }

  private buildHtml(payload: NotificationPayload): string {
    return `
      <!DOCTYPE html>
      <html><body style="font-family:sans-serif;padding:20px;max-width:600px">
        <h2 style="color:#1e3a5f">${payload.title}</h2>
        <p>${payload.message.replace(/\n/g, '<br>')}</p>
        ${payload.actions ? `
          <div style="margin-top:20px">
            ${payload.actions.map((a) => `<a href="${a.payload?.url || '#'}" style="display:inline-block;padding:10px 20px;margin:5px;background:#1e3a5f;color:white;text-decoration:none;border-radius:5px">${a.label}</a>`).join('')}
          </div>
        ` : ''}
        ${payload.metadata ? `<pre style="background:#f5f5f5;padding:10px;margin-top:20px;font-size:12px">${JSON.stringify(payload.metadata, null, 2)}</pre>` : ''}
      </body></html>
    `
  }
}

export const emailProvider = new EmailProvider()
