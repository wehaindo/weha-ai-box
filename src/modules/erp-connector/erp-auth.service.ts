import { databaseService } from '../database/database.service.js'

export interface ErpCredentials {
  serverUrl: string
  deviceToken: string
  tenantId: string
  deviceId?: string
  deviceCode?: string
}

const CONFIG_KEY = 'erp_credentials'

export class ErpAuthService {
  private credentials: ErpCredentials | null = null

  configure(creds: ErpCredentials) {
    this.credentials = creds
  }

  async persist() {
    if (!this.credentials) return
    try {
      const db = databaseService.getClient()
      await db.appConfig.upsert({
        where: { key: CONFIG_KEY },
        update: { value: JSON.stringify(this.credentials) },
        create: { key: CONFIG_KEY, value: JSON.stringify(this.credentials), encrypted: false },
      })
    } catch (err: any) {
      console.warn('Failed to persist ERP credentials:', err.message)
    }
  }

  async loadFromDatabase() {
    try {
      const db = databaseService.getClient()
      const config = await db.appConfig.findUnique({ where: { key: CONFIG_KEY } })
      if (config) {
        const creds = JSON.parse(config.value) as ErpCredentials
        this.credentials = creds
        console.log('ERP credentials loaded from database')
      } else {
        console.warn('No persisted ERP credentials found — use App Settings → ERP to configure, or visit Dashboard to auto-configure')
      }
    } catch (err: any) {
      console.warn('Failed to load ERP credentials:', err.message)
    }
  }

  isConfigured(): boolean {
    return this.credentials !== null && !!this.credentials.deviceToken && !!this.credentials.tenantId
  }

  getHeaders(): Record<string, string> {
    if (!this.credentials) {
      throw new Error('ERP credentials not configured. Call configure() first.')
    }
    return {
      Authorization: `Bearer ${this.credentials.deviceToken}`,
      'X-Tenant-ID': this.credentials.tenantId,
      'Content-Type': 'application/json',
    }
  }

  getServerUrl(): string {
    if (!this.credentials) throw new Error('ERP credentials not configured')
    return this.credentials.serverUrl.replace(/\/$/, '')
  }

  getCredentials(): ErpCredentials | null {
    return this.credentials
  }

  clear() {
    this.credentials = null
  }
}

export const erpAuthService = new ErpAuthService()
