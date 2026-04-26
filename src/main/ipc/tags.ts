import type { IpcMain } from 'electron'
import { getDb } from '../db/database'

export function registerTagHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('tags:list', () => {
    const rows = getDb()
      .prepare('SELECT DISTINCT tag FROM task_tags ORDER BY tag ASC')
      .all() as { tag: string }[]
    return rows.map((r) => r.tag)
  })
}
