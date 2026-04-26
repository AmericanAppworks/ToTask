import { execSync } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'

const dbPath = join(homedir(), 'Library', 'Application Support', 'ToTask', 'totask.db')

if (!existsSync(dbPath)) {
  console.log('No database found at', dbPath)
  process.exit(0)
}

const sql = `
PRAGMA foreign_keys = OFF;
DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM task_tags;
DELETE FROM tasks;
DELETE FROM folders;
DELETE FROM sqlite_sequence WHERE name IN ('messages','conversations','task_tags','tasks','folders');
DELETE FROM settings WHERE key = 'active_conversation_id';
PRAGMA foreign_keys = ON;
`

execSync(`sqlite3 "${dbPath}"`, { input: sql, stdio: ['pipe', 'inherit', 'inherit'] })

console.log('Reset complete — tasks, folders, and chat history cleared. Settings (API key, etc.) preserved.')
