export {}

interface ElectronUpdateInfo {
  version: string
  releaseNotes?: string | null
  releaseName?: string | null
  releaseDate?: string
}

interface ElectronDownloadProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

declare global {
  interface Window {
    electronAPI?: {
      getAll: () => Promise<Record<string, unknown>>
      set: (key: string, value: unknown) => Promise<boolean>
      get: (key: string) => Promise<unknown>
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
        onUpdateAvailable: (cb: (info: ElectronUpdateInfo) => void) => () => void
        onUpdateNotAvailable: (cb: (info: ElectronUpdateInfo) => void) => () => void
        onDownloadProgress: (cb: (progress: ElectronDownloadProgress) => void) => () => void
        onUpdateDownloaded: (cb: (info: ElectronUpdateInfo) => void) => () => void
        onError: (cb: (message: string) => void) => () => void
      }
    }
  }
}
