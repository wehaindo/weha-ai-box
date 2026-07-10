import type { NotificationProvider, NotificationPayload, NotificationResult } from '../types.js'
import { erpAuthService } from '../../erp-connector/erp-auth.service.js'

export const whotifProvider: NotificationProvider = {
  name: 'WHOTIF',
  channel: 'whotif',

  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    if (!erpAuthService.isConfigured()) {
      return payload.recipientIds.map((id) => ({
        id: '',
        type: payload.type,
        channel: 'whotif',
        status: 'FAILED' as const,
        recipientId: id,
        error: 'ERP not configured',
      }))
    }

    const baseUrl = erpAuthService.getServerUrl()
    const headers = erpAuthService.getHeaders()

    const results: NotificationResult[] = []

    for (const recipientId of payload.recipientIds) {
      try {
        const response = await fetch(`${baseUrl}/api/notifications`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            type: payload.type,
            title: payload.title,
            message: payload.message,
            priority: payload.priority || 'MEDIUM',
            recipientId,
            sender: payload.sender,
            metadata: payload.metadata,
            actions: payload.actions,
            conversationId: payload.conversationId,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          results.push({
            id: data?.data?.id || `whotif_${Date.now()}`,
            type: payload.type,
            channel: 'whotif',
            status: 'SENT',
            recipientId,
            sentAt: new Date().toISOString(),
          })
        } else {
          results.push({
            id: '',
            type: payload.type,
            channel: 'whotif',
            status: 'FAILED',
            recipientId,
            error: `WHOTIF returned ${response.status}`,
          })
        }
      } catch (err: any) {
        results.push({
          id: '',
          type: payload.type,
          channel: 'whotif',
          status: 'FAILED',
          recipientId,
          error: err.message,
        })
      }
    }

    return results
  },

  async sendApproval(payload: NotificationPayload): Promise<NotificationResult[]> {
    const approvalPayload: NotificationPayload = {
      ...payload,
      type: 'APPROVAL',
      actions: payload.actions || [
        { id: 'approve', label: 'Approve', type: 'APPROVAL', style: 'PRIMARY' },
        { id: 'reject', label: 'Reject', type: 'APPROVAL', style: 'DANGER' },
      ],
    }
    return this.send(approvalPayload)
  },
}
