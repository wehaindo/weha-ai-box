import type { NotificationProvider, NotificationPayload, NotificationResult } from '../types.js'

interface TelegramConfig {
  botToken: string
  apiBaseUrl?: string
}

class TelegramProvider implements NotificationProvider {
  name = 'Telegram'
  channel = 'telegram' as const
  private config: TelegramConfig | null = null

  configure(config: TelegramConfig) {
    this.config = config
  }

  isConfigured(): boolean {
    return this.config !== null && !!this.config.botToken
  }

  private getApiUrl(method: string): string {
    const base = this.config?.apiBaseUrl || 'https://api.telegram.org'
    return `${base}/bot${this.config!.botToken}/${method}`
  }

  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    if (!this.isConfigured()) {
      return payload.recipientIds.map((id) => ({
        id: '',
        type: payload.type,
        channel: 'telegram',
        status: 'FAILED' as const,
        recipientId: id,
        error: 'Telegram bot not configured',
      }))
    }

    const results: NotificationResult[] = []

    for (const recipientId of payload.recipientIds) {
      try {
        const text = this.formatMessage(payload)
        const inlineKeyboard = this.buildKeyboard(payload)

        const body: Record<string, unknown> = {
          chat_id: recipientId,
          text,
          parse_mode: 'HTML',
        }

        if (inlineKeyboard) {
          body.reply_markup = JSON.stringify({ inline_keyboard: inlineKeyboard })
        }

        const response = await fetch(this.getApiUrl('sendMessage'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (response.ok) {
          const data = await response.json()
          results.push({
            id: String(data?.result?.message_id || Date.now()),
            type: payload.type,
            channel: 'telegram',
            status: 'SENT',
            recipientId,
            sentAt: new Date().toISOString(),
          })
        } else {
          const errBody = await response.text().catch(() => '')
          results.push({
            id: '',
            type: payload.type,
            channel: 'telegram',
            status: 'FAILED',
            recipientId,
            error: `Telegram error: ${errBody}`,
          })
        }
      } catch (err: any) {
        results.push({
          id: '',
          type: payload.type,
          channel: 'telegram',
          status: 'FAILED',
          recipientId,
          error: err.message,
        })
      }
    }

    return results
  }

  async sendApproval(payload: NotificationPayload): Promise<NotificationResult[]> {
    const approvalPayload: NotificationPayload = {
      ...payload,
      actions: payload.actions || [
        { id: 'approve', label: '✅ Approve', type: 'APPROVAL', style: 'PRIMARY' },
        { id: 'reject', label: '❌ Reject', type: 'APPROVAL', style: 'DANGER' },
      ],
    }
    return this.send(approvalPayload)
  }

  private formatMessage(payload: NotificationPayload): string {
    const emoji: Record<string, string> = {
      INFO: 'ℹ️',
      APPROVAL: '✋',
      TASK: '📋',
      ALERT: '⚠️',
      REMINDER: '🔔',
      SYSTEM: '⚙️',
    }

    let text = `${emoji[payload.type] || '📩'} <b>${this.escapeHtml(payload.title)}</b>\n\n`
    text += this.escapeHtml(payload.message)

    if (payload.metadata) {
      const metaLines = Object.entries(payload.metadata)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n')
      if (metaLines) text += `\n\n<i>${metaLines}</i>`
    }

    return text
  }

  private buildKeyboard(payload: NotificationPayload): Array<Array<Record<string, string>>> | null {
    if (!payload.actions || payload.actions.length === 0) return null

    return payload.actions.map((action) => [
      {
        text: action.label,
        callback_data: JSON.stringify({
          action: 'notification_response',
          notificationId: payload.conversationId,
          actionId: action.id,
        }),
      },
    ])
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }
}

export const telegramProvider = new TelegramProvider()
