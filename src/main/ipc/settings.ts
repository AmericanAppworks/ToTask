import type { IpcMain } from 'electron'
import { getDb } from '../db/database'

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:get', (_, key: string) => {
    const row = getDb()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: string } | undefined
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', (_, key: string, value: string) => {
    getDb()
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value)
  })
}
