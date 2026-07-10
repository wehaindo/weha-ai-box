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

const DEFAULTS: DeviceConfig = {
  serverUrl: 'http://localhost:3000',
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

function api() {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return (window as any).electronAPI
  }
  return null
}

export async function getConfig(): Promise<DeviceConfig> {
  const electron = api()
  if (!electron) return { ...DEFAULTS }
  try {
    return (await electron.getAll()) as DeviceConfig
  } catch {
    return { ...DEFAULTS }
  }
}

export async function setConfigField(key: keyof DeviceConfig, value: unknown): Promise<void> {
  const electron = api()
  if (electron) await electron.set(key, value)
}

export async function saveDeviceCredentials(
  deviceToken: string, tenantId: string, deviceId: string,
  deviceName: string, deviceCode: string, deviceType: string, scopes: string[],
): Promise<void> {
  const electron = api()
  if (!electron) return
  await electron.set('deviceToken', deviceToken)
  await electron.set('tenantId', tenantId)
  await electron.set('deviceId', deviceId)
  await electron.set('deviceName', deviceName)
  await electron.set('deviceCode', deviceCode)
  await electron.set('deviceType', deviceType)
  await electron.set('scopes', scopes)
  await electron.set('registeredAt', new Date().toISOString())
}

export async function clearCredentials(): Promise<void> {
  const electron = api()
  if (electron) await electron.clearCredentials()
}

export async function isRegistered(): Promise<boolean> {
  const electron = api()
  if (!electron) return false
  return electron.isRegistered()
}

export async function getAppVersion(): Promise<string> {
  const electron = api()
  if (!electron) return 'web'
  return electron.getVersion()
}

export async function checkRuntimeHealth(): Promise<{ status: string; uptime?: number; database?: string }> {
  const electron = api()
  if (!electron) return { status: 'no-electron' }
  return await electron.runtime.health()
}

export async function runtimeCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const electron = api()
  if (!electron) {
    const runtimeUrl = 'http://127.0.0.1:4000'
    const options: RequestInit = {
      method,
    }
    if (body) {
      options.headers = { 'Content-Type': 'application/json' }
      options.body = JSON.stringify(body)
    }
    const response = await fetch(`${runtimeUrl}${path}`, options)
    return await response.json()
  }
  return await electron.runtime.call(method, path, body)
}

export interface OperatingConfig {
  platform: Record<string, any>
  features: Record<string, boolean>
  settings: Record<string, any>
  permissions: Record<string, any>
  serial?: Record<string, any>
  custom: Record<string, any>
  syncedAt: string
  deviceType: string
}

export async function getOperatingConfig(): Promise<OperatingConfig | null> {
  const config = await getConfig()
  if (!config.deviceConfig) return null
  const dc = config.deviceConfig as any
  return {
    platform:    dc.platform    ?? {},
    features:    dc.features    ?? {},
    settings:    dc.settings    ?? {},
    permissions: dc.permissions ?? {},
    serial:      dc.serial      ? dc.serial : undefined,
    custom:      dc.custom      ?? {},
    syncedAt:    config.deviceConfigSyncedAt ?? '',
    deviceType:  config.deviceType ?? '',
  }
}

export async function syncDeviceConfig(): Promise<Record<string, any>> {
  const config = await getConfig()

  if (!config.deviceToken || !config.tenantId || !config.deviceCode) {
    throw new Error('Device is not registered — cannot sync config')
  }

  const url = `${config.serverUrl.replace(/\/$/, '')}/api/device/v1/register-feature`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.deviceToken}`,
      'X-Tenant-ID': config.tenantId,
    },
    body: JSON.stringify({ deviceCode: config.deviceCode }),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Server returned ${res.status}`)
  }

  const device = data?.data?.device ?? data?.device
  if (!device) throw new Error('Unexpected response format from server')

  const serverConfig: Record<string, any> = device.config ?? {}
  const storedConfig: Record<string, any> = {
    platform:    serverConfig.platform    ?? {},
    features:    serverConfig.features    ?? {},
    settings:    serverConfig.settings    ?? {},
    permissions: serverConfig.permissions ?? device.permissions ?? {},
    ...(serverConfig.scenario ? { scenario: serverConfig.scenario } : {}),
    ...(serverConfig.serial   ? { serial:   serverConfig.serial  } : {}),
    ...(serverConfig.custom   ? { custom:   serverConfig.custom  } : {}),
  }

  const electron = api()
  if (electron) {
    await electron.set('deviceConfig',        storedConfig)
    await electron.set('deviceConfigSyncedAt', new Date().toISOString())
    if (device.name)         await electron.set('deviceName',  device.name)
    if (device.deviceType)   await electron.set('deviceType',  device.deviceType)
    if (device.deviceCode)   await electron.set('deviceCode',  device.deviceCode)
    if (device.store?.name)  await electron.set('storeName',   device.store.name)
  }

  return storedConfig
}
