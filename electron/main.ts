import { app, BrowserWindow, ipcMain, shell, Menu, nativeTheme, dialog } from 'electron'
import * as path from 'path'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
import type { UpdateInfo, ProgressInfo } from 'electron-updater'

const store = new Store({
  name: 'ai-box-config',
  defaults: {
    serverUrl: 'http://localhost:3000',
    runtimeUrl: 'http://127.0.0.1:4000',
    deviceToken: '',
    tenantId: '',
    deviceId: '',
    deviceName: '',
    deviceCode: '',
    deviceType: '',
    scopes: [] as string[],
    registeredAt: '',
    runtimePort: 4000,
    agentSyncEnabled: true,
    aiEnabled: false,
    localAiModel: '',
    storeName: '',
    deviceConfig: null as Record<string, any> | null,
    deviceConfigSyncedAt: '',
  },
})

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development'
const NEXT_PORT = 3111
const RENDERER_URL = isDev ? `http://localhost:${NEXT_PORT}` : `http://localhost:${NEXT_PORT}`

function setupAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('updater:checking-for-update')
  })
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    mainWindow?.webContents.send('updater:update-available', info)
  })
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    mainWindow?.webContents.send('updater:update-not-available', info)
  })
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    mainWindow?.webContents.send('updater:download-progress', progress)
  })
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    mainWindow?.webContents.send('updater:update-downloaded', info)
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version v${info.version} has been downloaded.`,
      detail: 'Restart the application to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall(false, true)
    })
  })
  autoUpdater.on('error', (err: Error) => {
    mainWindow?.webContents.send('updater:error', err.message)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'WEHA AI Box',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0f172a' : '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    show: false,
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.loadURL(RENDERER_URL)

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  createWindow()
  buildMenu()
  setupAutoUpdater()

  if (!isDev) {
    setTimeout(() => autoUpdater.checkForUpdates(), 5000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC handlers — store ────────────────────────────────────────────────────

ipcMain.handle('store:get-all', () => store.store)
ipcMain.handle('store:set', (_e, key: string, value: unknown) => {
  store.set(key, value)
  return true
})
ipcMain.handle('store:get', (_e, key: string) => store.get(key))

ipcMain.handle('store:clear-credentials', () => {
  store.set('deviceToken', '')
  store.set('tenantId', '')
  store.set('deviceId', '')
  store.set('deviceName', '')
  store.set('deviceCode', '')
  store.set('deviceType', '')
  store.set('storeName', '')
  store.set('scopes', [])
  store.set('registeredAt', '')
  store.set('deviceConfig', null)
  store.set('deviceConfigSyncedAt', '')
  return true
})

ipcMain.handle('store:is-registered', () => {
  return Boolean(store.get('deviceToken') && store.get('tenantId'))
})

// ─── IPC handlers — app info ─────────────────────────────────────────────────

ipcMain.handle('app:version', () => app.getVersion())
ipcMain.handle('app:open-external', (_e, url: string) => { shell.openExternal(url) })
ipcMain.handle('app:reload', () => { mainWindow?.webContents.reload() })

// ─── IPC handlers — runtime health ──────────────────────────────────────────

ipcMain.handle('runtime:health', async () => {
  const runtimeUrl = store.get('runtimeUrl') as string || 'http://127.0.0.1:4000'
  try {
    const response = await fetch(`${runtimeUrl}/api/health`, { signal: AbortSignal.timeout(3000) })
    return await response.json()
  } catch {
    return { status: 'unreachable', database: 'unknown' }
  }
})

ipcMain.handle('runtime:call', async (_e, method: string, path: string, body?: unknown) => {
  const runtimeUrl = store.get('runtimeUrl') as string || 'http://127.0.0.1:4000'
  try {
    const options: RequestInit = {
      method,
      signal: AbortSignal.timeout(10000),
    }
    if (body) {
      options.headers = { 'Content-Type': 'application/json' }
      options.body = JSON.stringify(body)
    }
    const response = await fetch(`${runtimeUrl}${path}`, options)
    return await response.json()
  } catch (err: any) {
    return { error: err.message }
  }
})

// ─── IPC handlers — auto-updater ─────────────────────────────────────────────

ipcMain.handle('updater:check-for-updates', async () => {
  if (isDev) {
    mainWindow?.webContents.send('updater:checking-for-update')
    await new Promise((r) => setTimeout(r, 800))
    const version = app.getVersion()
    mainWindow?.webContents.send('updater:update-not-available', { version })
    return null
  }
  return await autoUpdater.checkForUpdates()
})

ipcMain.handle('updater:download-update', () => { autoUpdater.downloadUpdate() })
ipcMain.handle('updater:install-update', () => { autoUpdater.quitAndInstall(false, true) })
ipcMain.handle('updater:get-current-version', () => app.getVersion())

// ─── Application menu ─────────────────────────────────────────────────────────

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About WEHA AI Box',
          click: () => { mainWindow?.webContents.executeJavaScript('window.location.href = \'/settings\'') },
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
