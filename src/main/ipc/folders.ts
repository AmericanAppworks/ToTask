import type { IpcMain } from 'electron'
import { getDb } from '../db/database'
import type { Folder } from '../../shared/types'

export function registerFolderHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('folders:list', () => {
    return getDb().prepare('SELECT * FROM folders ORDER BY name ASC').all() as Folder[]
  })

  ipcMain.handle('folders:create', (_, name: string) => {
    const db = getDb()
    const result = db.prepare('INSERT INTO folders (name) VALUES (?)').run(name)
    return db.prepare('SELECT * FROM folders WHERE id = ?').get(result.lastInsertRowid) as Folder
  })

  ipcMain.handle('folders:update', (_, id: number, name: string) => {
    const db = getDb()
    db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id)
    return db.prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder
  })

  ipcMain.handle('folders:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM folders WHERE id = ?').run(id)
  })
}
