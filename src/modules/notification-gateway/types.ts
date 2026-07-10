export type NotificationType =
  | 'INFO'
  | 'APPROVAL'
  | 'TASK'
  | 'ALERT'
  | 'FORM'
  | 'CHECKLIST'
  | 'REMINDER'
  | 'SYSTEM'

export type NotificationChannel =
  | 'whotif'
  | 'telegram'
  | 'email'
  | 'websocket'
  | 'firebase'
  | 'sms'

export type DeliveryStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'

export interface NotificationPayload {
  type: NotificationType
  title: string
  message: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  sender?: string
  recipientIds: string[]
  channels?: NotificationChannel[]
  metadata?: Record<string, unknown>
  actions?: NotificationAction[]
  conversationId?: string
  tenantId?: string
}

export interface NotificationAction {
  id: string
  label: string
  type: 'BUTTON' | 'APPROVAL' | 'FORM' | 'LINK'
  payload?: Record<string, unknown>
  style?: 'PRIMARY' | 'SECONDARY' | 'DANGER'
}

export interface NotificationResult {
  id: string
  type: NotificationType
  channel: NotificationChannel
  status: DeliveryStatus
  recipientId: string
  sentAt?: string
  error?: string
}

export interface NotificationProvider {
  name: string
  channel: NotificationChannel
  send(payload: NotificationPayload): Promise<NotificationResult[]>
  sendApproval?(payload: NotificationPayload): Promise<NotificationResult[]>
}

export interface ApprovalResponse {
  notificationId: string
  actionId: string
  userId: string
  response: 'APPROVED' | 'REJECTED'
  comment?: string
  timestamp: string
}
