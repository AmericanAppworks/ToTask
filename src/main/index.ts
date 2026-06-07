import {
  app,
  shell,
  Menu,
  dialog,
  BrowserWindow,
  ipcMain,
  type MessageBoxOptions,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './db/database'
import { registerTaskHandlers } from './ipc/tasks'
import { registerFolderHandlers } from './ipc/folders'
import { registerTagHandlers } from './ipc/tags'
import { registerSettingsHandlers } from './ipc/settings'
import { registerChatHandlers } from './ipc/chat'
import { startMcpServer } from './mcp/server'

const UPDATE_RELEASE_URL = 'https://api.github.com/repos/AmericanAppworks/ToTask/releases/latest'

let hasCheckedForUpdatesOnStartup = false

interface ReleaseAsset {
  name: string
  browser_download_url: string
}

interface LatestRelease {
  tag_name: string
  html_url: string
  assets: ReleaseAsset[]
}

function normalizeVersion(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0)
}

function isReleaseNewer(currentVersion: string, releaseVersion: string): boolean {
  const currentParts = normalizeVersion(currentVersion)
  const releaseParts = normalizeVersion(releaseVersion)
  const maxLength = Math.max(currentParts.length, releaseParts.length)

  for (let index = 0; index < maxLength; index += 1) {
    const current = currentParts[index] ?? 0
    const release = releaseParts[index] ?? 0
    if (release > current) return true
    if (release < current) return false
  }

  return false
}

async function fetchLatestRelease(): Promise<LatestRelease | null> {
  try {
    const response = await fetch(UPDATE_RELEASE_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ToTask'
      }
    })
    if (!response.ok) return null
    return (await response.json()) as LatestRelease
  } catch {
    return null
  }
}

function getMacArchiveDownloadUrl(release: LatestRelease): string {
  const archiveAsset =
    release.assets.find((asset) => asset.name.toLowerCase().endsWith('.zip')) ??
    release.assets.find((asset) => asset.name.toLowerCase().endsWith('.dmg'))
  return archiveAsset?.browser_download_url ?? release.html_url
}

function showMessageBox(options: MessageBoxOptions, parentWindow?: BrowserWindow) {
  return parentWindow ? dialog.showMessageBox(parentWindow, options) : dialog.showMessageBox(options)
}

async function checkForUpdates(manual: boolean, parentWindow?: BrowserWindow): Promise<void> {
  if (process.platform !== 'darwin') {
    if (manual) {
      await showMessageBox({
        type: 'info',
        message: 'Updates are currently only available on macOS.',
        buttons: ['OK']
      }, parentWindow)
    }
    return
  }

  const release = await fetchLatestRelease()
  if (!release) {
    if (manual) {
      await showMessageBox({
        type: 'error',
        message: 'Unable to check for updates right now.',
        detail: 'Please try again later.',
        buttons: ['OK']
      }, parentWindow)
    }
    return
  }

  const currentVersion = app.getVersion()
  if (!isReleaseNewer(currentVersion, release.tag_name)) {
    if (manual) {
      await showMessageBox({
        type: 'info',
        message: 'You are up to date.',
        detail: `ToTask ${currentVersion} is the latest version.`,
        buttons: ['OK']
      }, parentWindow)
    }
    return
  }

  const updateVersion = release.tag_name.replace(/^v/i, '')
  const { response } = await showMessageBox({
    type: 'info',
    message: `ToTask ${updateVersion} is available.`,
    detail: 'Download the latest archive and drag ToTask into Applications to upgrade.',
    buttons: ['Download Update', 'Later'],
    defaultId: 0,
    cancelId: 1
  }, parentWindow)

  if (response !== 0) return

  await shell.openExternal(getMacArchiveDownloadUrl(release))
  await showMessageBox({
    type: 'info',
    message: 'Finish updating ToTask',
    detail: 'Open the downloaded archive, then drag ToTask into the Applications folder.',
    buttons: ['OK']
  }, parentWindow)
}

function createAppMenu(mainWindow: BrowserWindow): void {
  const checkForUpdatesItem = (): MenuItemConstructorOptions => ({
    label: 'Check for Updates...',
    click: () => {
      void checkForUpdates(true, BrowserWindow.getFocusedWindow() ?? mainWindow)
    }
  })

  const template: MenuItemConstructorOptions[] =
    process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              checkForUpdatesItem(),
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          },
          { role: 'fileMenu' },
          { role: 'editMenu' },
          { role: 'viewMenu' },
          { role: 'windowMenu' },
          { role: 'help', submenu: [checkForUpdatesItem()] }
        ]
      : [{ role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'help', submenu: [checkForUpdatesItem()] }]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (!hasCheckedForUpdatesOnStartup) {
      hasCheckedForUpdatesOnStartup = true
      void checkForUpdates(false, mainWindow)
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  createAppMenu(mainWindow)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.totask')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()
  registerTaskHandlers(ipcMain)
  registerFolderHandlers(ipcMain)
  registerTagHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerChatHandlers(ipcMain)
  ipcMain.handle('shell:openExternal', (_event: IpcMainInvokeEvent, url: string) => shell.openExternal(url))

  const mcpPort = 3737
  startMcpServer(mcpPort)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
