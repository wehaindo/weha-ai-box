import { databaseService } from '../database/database.service.js'

export interface DeviceConfig {
  serverUrl: string
  runtimeUrl: string
  deviceToken: string
  tenantId: string
  deviceId: string
  deviceName: string
  deviceCode: string
  deviceType: string
  storeName: string
  scopes: string[]
  registeredAt: string
  runtimePort: number
  agentSyncEnabled: boolean
  aiEnabled: boolean
  localAiModel: string
  deviceConfig: Record<string, any> | null
  deviceConfigSyncedAt: string
}

const CONFIG_KEY = 'device_config'

const DEFAULTS: DeviceConfig = {
  serverUrl: '',
  runtimeUrl: 'http://127.0.0.1:4000',
  deviceToken: '',
  tenantId: '',
  deviceId: '',
  deviceName: '',
  deviceCode: '',
  deviceType: '',
  storeName: '',
  scopes: [],
  registeredAt: '',
  runtimePort: 4000,
  agentSyncEnabled: true,
  aiEnabled: false,
  localAiModel: '',
  deviceConfig: null,
  deviceConfigSyncedAt: '',
}

export class DeviceConfigService {
  private cached: DeviceConfig | null = null

  async loadFromDatabase(): Promise<DeviceConfig> {
    try {
      const db = databaseService.getClient()
      const config = await db.appConfig.findUnique({ where: { key: CONFIG_KEY } })
      if (config) {
        this.cached = { ...DEFAULTS, ...(JSON.parse(config.value) as Partial<DeviceConfig>) }
      } else {
        this.cached = { ...DEFAULTS }
      }
    } catch (err: any) {
      console.warn('Failed to load device config:', err.message)
      this.cached = { ...DEFAULTS }
    }
    return this.get()
  }

  get(): DeviceConfig {
    if (!this.cached) this.cached = { ...DEFAULTS }
    return { ...this.cached }
  }

  async save(patch: Partial<DeviceConfig>): Promise<DeviceConfig> {
    const current = this.get()
    const merged: DeviceConfig = { ...current, ...patch }
    this.cached = merged
    try {
      const db = databaseService.getClient()
      await db.appConfig.upsert({
        where: { key: CONFIG_KEY },
        update: { value: JSON.stringify(merged), encrypted: false },
        create: { key: CONFIG_KEY, value: JSON.stringify(merged), encrypted: false },
      })
    } catch (err: any) {
      console.warn('Failed to persist device config:', err.message)
    }
    return merged
  }

  async clearCredentials(): Promise<void> {
    this.cached = { ...DEFAULTS, serverUrl: this.cached?.serverUrl || DEFAULTS.serverUrl }
    try {
      const db = databaseService.getClient()
      await db.appConfig.upsert({
        where: { key: CONFIG_KEY },
        update: { value: JSON.stringify(this.cached), encrypted: false },
        create: { key: CONFIG_KEY, value: JSON.stringify(this.cached), encrypted: false },
      })
    } catch (err: any) {
      console.warn('Failed to clear device config:', err.message)
    }
  }

  isRegistered(): boolean {
    const c = this.get()
    return Boolean(c.deviceToken && c.tenantId)
  }
}

export const deviceConfigService = new DeviceConfigService()
