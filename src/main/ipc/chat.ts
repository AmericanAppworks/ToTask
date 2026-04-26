import { BrowserWindow } from 'electron'
import type { IpcMain } from 'electron'
import { getDb } from '../db/database'
import { runConversation } from '../claude/client'
import type { Task, Message, Conversation } from '../../shared/types'

export function registerChatHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'chat:send',
    async (event, message: string, conversationId: number, taskContext?: Task | null) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return

      const db = getDb()
      const row = db
        .prepare('SELECT value FROM settings WHERE key = ?')
        .get('anthropic_api_key') as { value: string } | undefined

      if (!row?.value) {
        win.webContents.send('chat:error', 'NO_API_KEY')
        return
      }

      try {
        await runConversation(row.value, conversationId, message, db, win, taskContext)
      } catch (e) {
        win.webContents.send('chat:error', e instanceof Error ? e.message : 'Unknown error')
      }
    }
  )

  ipcMain.handle('chat:history', (_, conversationId: number) => {
    return getDb()
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(conversationId) as Message[]
  })

  ipcMain.handle('chat:newConversation', () => {
    const db = getDb()
    const result = db.prepare('INSERT INTO conversations (created_at) VALUES (unixepoch())').run()
    return db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(result.lastInsertRowid) as Conversation
  })
}
