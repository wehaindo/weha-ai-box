import { erpAuthService } from './erp-auth.service.js'

export interface QueryOptions {
  filter?: Record<string, unknown>
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
  include?: string[]
}

export interface QueryResult<T = unknown> {
  data: T[]
  total: number
  page: number
  limit: number
}

export class ErpClientService {
  async query<T = unknown>(endpoint: string, options: QueryOptions = {}): Promise<QueryResult<T>> {
    const baseUrl = erpAuthService.getServerUrl()
    const headers = erpAuthService.getHeaders()

    const params = new URLSearchParams()
    if (options.page) params.set('page', String(options.page))
    if (options.limit) params.set('limit', String(options.limit))
    if (options.sort) params.set('sort', options.sort)
    if (options.order) params.set('order', options.order)
    if (options.filter) params.set('filter', JSON.stringify(options.filter))
    if (options.include?.length) params.set('include', options.include.join(','))

    const queryString = params.toString()
    const url = `${baseUrl}/api/${endpoint.replace(/^\//, '')}${queryString ? `?${queryString}` : ''}`

    const response = await fetch(url, { headers })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ERP query failed: ${response.status} ${response.statusText} — ${body}`)
    }

    return await response.json()
  }

  async getById<T = unknown>(endpoint: string, id: string): Promise<T | null> {
    const baseUrl = erpAuthService.getServerUrl()
    const headers = erpAuthService.getHeaders()
    const url = `${baseUrl}/api/${endpoint.replace(/^\//, '')}/${id}`

    const response = await fetch(url, { headers })
    if (response.status === 404) return null
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ERP get failed: ${response.status} — ${body}`)
    }

    return await response.json()
  }

  async create<T = unknown>(endpoint: string, data: Record<string, unknown>): Promise<T> {
    const baseUrl = erpAuthService.getServerUrl()
    const headers = erpAuthService.getHeaders()
    const url = `${baseUrl}/api/${endpoint.replace(/^\//, '')}`

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ERP create failed: ${response.status} — ${body}`)
    }

    return await response.json()
  }

  async update<T = unknown>(endpoint: string, id: string, data: Record<string, unknown>): Promise<T> {
    const baseUrl = erpAuthService.getServerUrl()
    const headers = erpAuthService.getHeaders()
    const url = `${baseUrl}/api/${endpoint.replace(/^\//, '')}/${id}`

    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ERP update failed: ${response.status} — ${body}`)
    }

    return await response.json()
  }

  async delete(endpoint: string, id: string): Promise<boolean> {
    const baseUrl = erpAuthService.getServerUrl()
    const headers = erpAuthService.getHeaders()
    const url = `${baseUrl}/api/${endpoint.replace(/^\//, '')}/${id}`

    const response = await fetch(url, { method: 'DELETE', headers })
    if (response.status === 404) return false
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ERP delete failed: ${response.status} — ${body}`)
    }
    return true
  }

  async action(endpoint: string, data: Record<string, unknown> = {}): Promise<unknown> {
    const baseUrl = erpAuthService.getServerUrl()
    const headers = erpAuthService.getHeaders()
    const url = `${baseUrl}/api/${endpoint.replace(/^\//, '')}`

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`ERP action failed: ${response.status} — ${body}`)
    }

    return await response.json()
  }

  async waitForApproval(approvalId: string, pollIntervalMs = 5000, timeoutMs = 300000): Promise<unknown> {
    const baseUrl = erpAuthService.getServerUrl()
    const headers = erpAuthService.getHeaders()
    const start = Date.now()

    while (Date.now() - start < timeoutMs) {
      const response = await fetch(`${baseUrl}/api/approvals/${approvalId}`, { headers })

      if (response.ok) {
        const result = await response.json()
        const status = (result as any)?.data?.status || (result as any)?.status
        if (status === 'APPROVED' || status === 'REJECTED' || status === 'COMPLETED') {
          return result
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }

    throw new Error(`Approval ${approvalId} timed out after ${timeoutMs}ms`)
  }
}

export const erpClientService = new ErpClientService()
