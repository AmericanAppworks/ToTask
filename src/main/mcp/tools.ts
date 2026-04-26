import { getDb } from '../db/database'
import { SELECT_TASK_FIELDS, rowToTask, getTaskById } from '../db/taskQueries'
import type { Task, Folder } from '../../shared/types'

interface SubtaskInput {
  title: string
  due_date?: string | null
  notes?: string | null
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export function listTasks(filters: {
  folder_id?: number
  tag?: string
  completed?: boolean
  due_before?: string
  parent_id?: number
} = {}): Task[] {
  const db = getDb()
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.folder_id !== undefined) {
    conditions.push('t.folder_id = ?')
    params.push(filters.folder_id)
  }
  if (filters.completed !== undefined) {
    conditions.push('t.completed = ?')
    params.push(filters.completed ? 1 : 0)
  }
  if (filters.tag) {
    conditions.push('EXISTS (SELECT 1 FROM task_tags WHERE task_id = t.id AND tag = ?)')
    params.push(filters.tag)
  }
  if (filters.due_before) {
    conditions.push('t.due_date <= ?')
    params.push(filters.due_before)
  }
  if (filters.parent_id !== undefined) {
    conditions.push('t.parent_id = ?')
    params.push(filters.parent_id)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db
    .prepare(`${SELECT_TASK_FIELDS} ${where} ORDER BY t.completed ASC, t.due_date ASC NULLS LAST, t.created_at DESC`)
    .all(...params) as Record<string, unknown>[]
  return rows.map(rowToTask)
}

export function getTask(id: number): Task {
  const task = getTaskById(getDb(), id)
  if (!task) throw new Error(`Task ${id} not found`)
  return task
}

export function createTask(input: {
  title: string
  folder_id?: number | null
  parent_id?: number | null
  due_date?: string | null
  notes?: string | null
  tags?: string[]
}): Task {
  const db = getDb()
  const { title, folder_id = null, parent_id = null, due_date = null, notes = null, tags = [] } = input

  const result = db
    .prepare('INSERT INTO tasks (title, folder_id, parent_id, due_date, notes) VALUES (?, ?, ?, ?, ?)')
    .run(title, folder_id, parent_id, due_date, notes)

  const id = result.lastInsertRowid as number

  if (tags.length) {
    const ins = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES (?, ?)')
    for (const tag of tags) ins.run(id, tag)
  }

  return getTask(id)
}

export function updateTask(
  id: number,
  input: {
    title?: string
    folder_id?: number | null
    parent_id?: number | null
    due_date?: string | null
    notes?: string | null
    tags?: string[]
  }
): Task {
  const db = getDb()
  const setClauses = ['updated_at = unixepoch()']
  const params: unknown[] = []

  if (input.title !== undefined) { setClauses.push('title = ?'); params.push(input.title) }
  if (input.folder_id !== undefined) { setClauses.push('folder_id = ?'); params.push(input.folder_id) }
  if (input.parent_id !== undefined) { setClauses.push('parent_id = ?'); params.push(input.parent_id) }
  if (input.due_date !== undefined) { setClauses.push('due_date = ?'); params.push(input.due_date) }
  if (input.notes !== undefined) { setClauses.push('notes = ?'); params.push(input.notes) }

  db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...params, id)

  if (input.tags !== undefined) {
    db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(id)
    const ins = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES (?, ?)')
    for (const tag of input.tags) ins.run(id, tag)
  }

  return getTask(id)
}

export function completeTask(id: number, completed: boolean): Task {
  getDb()
    .prepare('UPDATE tasks SET completed = ?, completed_at = ?, updated_at = unixepoch() WHERE id = ?')
    .run(completed ? 1 : 0, completed ? Math.floor(Date.now() / 1000) : null, id)
  return getTask(id)
}

export function deleteTask(id: number): void {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

export function splitTask(parentId: number, subtasks: SubtaskInput[]): Task[] {
  const db = getDb()
  const parent = db.prepare('SELECT folder_id FROM tasks WHERE id = ?').get(parentId) as { folder_id: number | null } | undefined
  if (!parent) throw new Error(`Parent task ${parentId} not found`)

  const ins = db.prepare('INSERT INTO tasks (title, folder_id, parent_id, due_date, notes) VALUES (?, ?, ?, ?, ?)')

  return db.transaction(() =>
    subtasks.map((st) => {
      const r = ins.run(st.title, parent.folder_id, parentId, st.due_date ?? null, st.notes ?? null)
      return getTask(r.lastInsertRowid as number)
    })
  )()
}

// ── Folders ──────────────────────────────────────────────────────────────────

export function listFolders(): Folder[] {
  return getDb().prepare('SELECT * FROM folders ORDER BY name ASC').all() as Folder[]
}

export function createFolder(name: string): Folder {
  const db = getDb()
  const r = db.prepare('INSERT INTO folders (name) VALUES (?)').run(name)
  return db.prepare('SELECT * FROM folders WHERE id = ?').get(r.lastInsertRowid) as Folder
}

export function deleteFolder(id: number): void {
  getDb().prepare('DELETE FROM folders WHERE id = ?').run(id)
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export function listTags(): string[] {
  return (getDb().prepare('SELECT DISTINCT tag FROM task_tags ORDER BY tag ASC').all() as { tag: string }[]).map(r => r.tag)
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

export function executeTool(name: string, input: Record<string, unknown>): unknown {
  switch (name) {
    case 'list_tasks':   return listTasks(input as Parameters<typeof listTasks>[0])
    case 'get_task':     return getTask(input.id as number)
    case 'create_task':  return createTask(input as Parameters<typeof createTask>[0])
    case 'update_task':  return updateTask(input.id as number, input as Parameters<typeof updateTask>[1])
    case 'complete_task': return completeTask(input.id as number, Boolean(input.completed))
    case 'delete_task':  { deleteTask(input.id as number); return { deleted: true } }
    case 'split_task':   return splitTask(input.parent_id as number, input.subtasks as SubtaskInput[])
    case 'list_folders': return listFolders()
    case 'create_folder': return createFolder(input.name as string)
    case 'delete_folder': { deleteFolder(input.id as number); return { deleted: true } }
    case 'list_tags':    return listTags()
    default: throw new Error(`Unknown tool: ${name}`)
  }
}
