import { contextBridge, ipcRenderer } from 'electron'

export interface AiBoxStore {
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

export interface ElectronAPI {
  getAll: () => Promise<AiBoxStore>
  set: (key: keyof AiBoxStore, value: unknown) => Promise<boolean>
  get: (key: keyof AiBoxStore) => Promise<unknown>
  clearCredentials: () => Promise<boolean>
  isRegistered: () => Promise<boolean>
  getVersion: () => Promise<string>
  openExternal: (url: string) => Promise<void>
  reload: () => Promise<void>
  runtime: {
    health: () => Promise<{ status: string; uptime?: number; database?: string }>
    call: (method: string, path: string, body?: unknown) => Promise<unknown>
  }
  updater: {
    checkForUpdates: () => Promise<void>
    downloadUpdate: () => Promise<void>
    installUpdate: () => Promise<void>
    getCurrentVersion: () => Promise<string>
    onCheckingForUpdate: (cb: () => void) => () => void
    onUpdateAvailable: (cb: (info: any) => void) => () => void
    onUpdateNotAvailable: (cb: (info: any) => void) => () => void
    onDownloadProgress: (cb: (progress: any) => void) => () => void
    onUpdateDownloaded: (cb: (info: any) => void) => () => void
    onError: (cb: (message: string) => void) => () => void
  }
}

function onEvent<T>(channel: string, cb: (data: T) => void) {
  const listener = (_: Electron.IpcRendererEvent, data: T) => cb(data)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('electronAPI', {
  getAll: () => ipcRenderer.invoke('store:get-all'),
  set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  get: (key: string) => ipcRenderer.invoke('store:get', key),
  clearCredentials: () => ipcRenderer.invoke('store:clear-credentials'),
  isRegistered: () => ipcRenderer.invoke('store:is-registered'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  reload: () => ipcRenderer.invoke('app:reload'),

  runtime: {
    health: () => ipcRenderer.invoke('runtime:health'),
    call: (method: string, path: string, body?: unknown) => ipcRenderer.invoke('runtime:call', method, path, body),
  },

  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('updater:download-update'),
    installUpdate: () => ipcRenderer.invoke('updater:install-update'),
    getCurrentVersion: () => ipcRenderer.invoke('updater:get-current-version'),
    onCheckingForUpdate: (cb: () => void) => onEvent('updater:checking-for-update', cb),
    onUpdateAvailable: (cb: (info: any) => void) => onEvent('updater:update-available', cb),
    onUpdateNotAvailable: (cb: (info: any) => void) => onEvent('updater:update-not-available', cb),
    onDownloadProgress: (cb: (progress: any) => void) => onEvent('updater:download-progress', cb),
    onUpdateDownloaded: (cb: (info: any) => void) => onEvent('updater:update-downloaded', cb),
    onError: (cb: (message: string) => void) => onEvent('updater:error', cb),
  },
} satisfies ElectronAPI)
