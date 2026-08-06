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
  serverUrl: '',
  runtimeUrl: '/api/runtime',
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

function proxyUrl(path: string): string {
  return `/api/runtime${path}`
}

export async function getConfig(): Promise<DeviceConfig> {
  try {
    const res = await fetch(proxyUrl('/api/device/config'))
    if (!res.ok) return { ...DEFAULTS }
    const data = await res.json()
    return { ...DEFAULTS, ...(data?.data ?? {}) } as DeviceConfig
  } catch {
    return { ...DEFAULTS }
  }
}

export async function setConfigField(key: keyof DeviceConfig, value: unknown): Promise<void> {
  await fetch(proxyUrl('/api/device/config'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [key]: value }),
  })
}

export async function saveDeviceCredentials(
  deviceToken: string, tenantId: string, deviceId: string,
  deviceName: string, deviceCode: string, deviceType: string, scopes: string[],
): Promise<void> {
  await fetch(proxyUrl('/api/device/config'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceToken,
      tenantId,
      deviceId,
      deviceName,
      deviceCode,
      deviceType,
      scopes,
      registeredAt: new Date().toISOString(),
    }),
  })
}

export async function clearCredentials(): Promise<void> {
  await fetch(proxyUrl('/api/device/config'), { method: 'DELETE' })
}

export async function isRegistered(): Promise<boolean> {
  const config = await getConfig()
  return Boolean(config.deviceToken && config.tenantId)
}

export async function getAppVersion(): Promise<string> {
  try {
    const res = await fetch(proxyUrl('/api/health'))
    if (!res.ok) return 'web'
    const data = await res.json()
    return data?.version || 'web'
  } catch {
    return 'web'
  }
}

export async function checkRuntimeHealth(): Promise<{ status: string; uptime?: number; database?: string }> {
  try {
    const res = await fetch(proxyUrl('/api/health'))
    return await res.json()
  } catch {
    return { status: 'unreachable' }
  }
}

export async function runtimeCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const options: RequestInit = { method }
  if (body) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(body)
  }
  const res = await fetch(proxyUrl(path), options)
  return await res.json()
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

  const res = (await runtimeCall('POST', '/api/device/register-feature')) as {
    ok: boolean
    status: number
    data?: any
    error?: string
  }

  if (!res.ok) {
    throw new Error(res.error || res.data?.error || res.data?.message || `Server returned ${res.status}`)
  }

  const device = res.data?.data?.device ?? res.data?.device
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

  const patch: Record<string, unknown> = {
    deviceConfig:        storedConfig,
    deviceConfigSyncedAt: new Date().toISOString(),
  }
  if (device.name)       patch.deviceName = device.name
  if (device.deviceType) patch.deviceType = device.deviceType
  if (device.deviceCode) patch.deviceCode = device.deviceCode
  if (device.store?.name) patch.storeName = device.store.name

  await fetch(proxyUrl('/api/device/config'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })

  return storedConfig
}
