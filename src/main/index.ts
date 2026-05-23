import { app, BrowserWindow, shell, ipcMain, nativeImage } from 'electron'
import { join } from 'path'
import { initDatabase } from './database'
import { registerNovelHandlers } from './ipc/novels'
import { registerChapterHandlers } from './ipc/chapters'
import { registerCharacterHandlers } from './ipc/characters'
import { registerOutlineHandlers } from './ipc/outlines'
import { registerSettingsHandlers } from './ipc/settings'
import { registerVolumeHandlers } from './ipc/volumes'
import { registerWorldSettingHandlers } from './ipc/worldSettings'
import { registerAIHandlers } from './ipc/ai'
import { registerExportHandlers } from './ipc/export'
import { registerStatHandlers } from './ipc/stats'
import { registerSearchHandlers } from './ipc/search'
import { registerTemplateHandlers } from './ipc/templates'
import { registerStyleHandlers } from './ipc/styles'
import { registerSyncHandlers } from './ipc/sync'
import { registerAuthHandlers } from './ipc/auth'
import { registerImportHandlers } from './ipc/import'
import { registerBackupHandlers } from './ipc/backup'

let mainWindow: BrowserWindow | null = null
const iconPath = app.isPackaged
  ? join(process.resourcesPath, 'icon.png')
  : join(__dirname, '../../resources/icon.png')

function createWindow() {
  const icon = nativeImage.createFromPath(iconPath)
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'HappyWrite - 网文写作助手',
    show: false,
    backgroundColor: '#1a1a2e',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show()
  })
}

app.whenReady().then(async () => {
  const db = initDatabase()

  // macOS Dock icon
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(iconPath)
  }

  registerNovelHandlers(ipcMain, db)
  registerChapterHandlers(ipcMain, db)
  registerCharacterHandlers(ipcMain, db)
  registerOutlineHandlers(ipcMain, db)
  registerSettingsHandlers(ipcMain, db)
  registerVolumeHandlers(ipcMain, db)
  registerWorldSettingHandlers(ipcMain, db)
  registerAIHandlers(ipcMain, db)
  registerExportHandlers(ipcMain, db)
  registerStatHandlers(ipcMain, db)
  registerSearchHandlers(ipcMain, db)
  registerTemplateHandlers(ipcMain, db)
  registerStyleHandlers(ipcMain, db)
  registerSyncHandlers(ipcMain, db)
  registerAuthHandlers(ipcMain, db)
  registerImportHandlers(ipcMain)
  registerBackupHandlers(ipcMain, db)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
