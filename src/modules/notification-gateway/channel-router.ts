import type { NotificationChannel, NotificationType, NotificationPayload } from './types.js'

interface ChannelRule {
  types: NotificationType[]
  channels: NotificationChannel[]
  priority: number
}

const defaultRules: ChannelRule[] = [
  { types: ['APPROVAL'], channels: ['whotif', 'telegram'], priority: 1 },
  { types: ['ALERT', 'URGENT'], channels: ['whotif', 'telegram', 'sms'], priority: 1 },
  { types: ['TASK'], channels: ['whotif', 'email'], priority: 2 },
  { types: ['INFO', 'REMINDER'], channels: ['whotif', 'email'], priority: 3 },
  { types: ['SYSTEM'], channels: ['whotif', 'websocket'], priority: 2 },
]

class ChannelRouter {
  private rules: ChannelRule[] = [...defaultRules]

  setRules(rules: ChannelRule[]) {
    this.rules = rules
  }

  resolve(payload: NotificationPayload): NotificationChannel[] {
    if (payload.channels && payload.channels.length > 0) {
      return payload.channels
    }

    const matched = this.rules
      .filter((r) => r.types.includes(payload.type))
      .sort((a, b) => a.priority - b.priority)

    if (matched.length > 0) {
      return matched[0].channels
    }

    return ['whotif']
  }
}

export const channelRouter = new ChannelRouter()
