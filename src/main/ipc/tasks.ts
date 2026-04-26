import type { IpcMain } from 'electron'
import { getDb } from '../db/database'
import { SELECT_TASK_FIELDS, rowToTask } from '../db/taskQueries'
import type { CreateTaskInput, UpdateTaskInput, SplitTaskInput, TaskFilters } from '../../shared/types'

export function registerTaskHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(
    'tasks:list',
    (_, folderId: number | null | undefined, filters: TaskFilters = {}) => {
      const db = getDb()
      const conditions: string[] = []
      const params: unknown[] = []

      if (folderId !== undefined) {
        if (folderId === null) {
          conditions.push('t.folder_id IS NULL')
        } else {
          conditions.push('t.folder_id = ?')
          params.push(folderId)
        }
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

      if (filters.due_after) {
        conditions.push('t.due_date >= ?')
        params.push(filters.due_after)
      }

      if (filters.parent_id !== undefined) {
        if (filters.parent_id === null) {
          conditions.push('t.parent_id IS NULL')
        } else {
          conditions.push('t.parent_id = ?')
          params.push(filters.parent_id)
        }
      }

      if (!filters.showParents) {
        conditions.push(
          '(SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND completed = 0) = 0'
        )
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      const sql = `${SELECT_TASK_FIELDS} ${where} ORDER BY t.completed ASC, t.due_date ASC NULLS LAST, t.created_at DESC`
      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
      return rows.map(rowToTask)
    }
  )

  ipcMain.handle('tasks:get', (_, id: number) => {
    const db = getDb()
    const row = db
      .prepare(`${SELECT_TASK_FIELDS} WHERE t.id = ?`)
      .get(id) as Record<string, unknown> | undefined
    if (!row) throw new Error(`Task ${id} not found`)
    return rowToTask(row)
  })

  ipcMain.handle('tasks:create', (_, input: CreateTaskInput) => {
    const db = getDb()
    const {
      title,
      folder_id = null,
      parent_id = null,
      due_date = null,
      notes = null,
      tags = []
    } = input

    const result = db
      .prepare(
        'INSERT INTO tasks (title, folder_id, parent_id, due_date, notes) VALUES (?, ?, ?, ?, ?)'
      )
      .run(title, folder_id, parent_id, due_date, notes)

    const id = result.lastInsertRowid as number

    if (tags.length > 0) {
      const insertTag = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES (?, ?)')
      for (const tag of tags) {
        insertTag.run(id, tag)
      }
    }

    const row = db
      .prepare(`${SELECT_TASK_FIELDS} WHERE t.id = ?`)
      .get(id) as Record<string, unknown>
    return rowToTask(row)
  })

  ipcMain.handle('tasks:update', (_, id: number, input: UpdateTaskInput) => {
    const db = getDb()
    const setClauses: string[] = ['updated_at = unixepoch()']
    const params: unknown[] = []

    if (input.title !== undefined) {
      setClauses.push('title = ?')
      params.push(input.title)
    }
    if (input.folder_id !== undefined) {
      setClauses.push('folder_id = ?')
      params.push(input.folder_id)
    }
    if (input.parent_id !== undefined) {
      setClauses.push('parent_id = ?')
      params.push(input.parent_id)
    }
    if (input.due_date !== undefined) {
      setClauses.push('due_date = ?')
      params.push(input.due_date)
    }
    if (input.notes !== undefined) {
      setClauses.push('notes = ?')
      params.push(input.notes)
    }

    db.prepare(`UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`).run(...params, id)

    if (input.tags !== undefined) {
      db.prepare('DELETE FROM task_tags WHERE task_id = ?').run(id)
      const insertTag = db.prepare('INSERT OR IGNORE INTO task_tags (task_id, tag) VALUES (?, ?)')
      for (const tag of input.tags) {
        insertTag.run(id, tag)
      }
    }

    const row = db
      .prepare(`${SELECT_TASK_FIELDS} WHERE t.id = ?`)
      .get(id) as Record<string, unknown>
    return rowToTask(row)
  })

  ipcMain.handle('tasks:delete', (_, id: number) => {
    getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
  })

  ipcMain.handle('tasks:complete', (_, id: number, completed: boolean) => {
    const db = getDb()
    db.prepare(
      'UPDATE tasks SET completed = ?, completed_at = ?, updated_at = unixepoch() WHERE id = ?'
    ).run(completed ? 1 : 0, completed ? Math.floor(Date.now() / 1000) : null, id)

    const row = db
      .prepare(`${SELECT_TASK_FIELDS} WHERE t.id = ?`)
      .get(id) as Record<string, unknown>
    return rowToTask(row)
  })

  ipcMain.handle('tasks:subtasks', (_, parentId: number) => {
    const db = getDb()
    const rows = db
      .prepare(`${SELECT_TASK_FIELDS} WHERE t.parent_id = ? ORDER BY t.created_at ASC`)
      .all(parentId) as Record<string, unknown>[]
    return rows.map(rowToTask)
  })

  ipcMain.handle('tasks:listByCompletedDate', (_, date: string) => {
    const db = getDb()
    // Parse as local midnight so the date matches the user's timezone
    const start = new Date(date + 'T00:00:00').getTime() / 1000
    const end = start + 86400
    const rows = db
      .prepare(
        `${SELECT_TASK_FIELDS} WHERE t.completed = 1 AND t.completed_at >= ? AND t.completed_at < ? ORDER BY t.completed_at ASC`
      )
      .all(start, end) as Record<string, unknown>[]
    return rows.map(rowToTask)
  })

  ipcMain.handle('tasks:split', (_, input: SplitTaskInput) => {
    const db = getDb()
    const { parent_id, subtasks } = input

    const parent = db
      .prepare('SELECT folder_id FROM tasks WHERE id = ?')
      .get(parent_id) as { folder_id: number | null } | undefined
    if (!parent) throw new Error(`Parent task ${parent_id} not found`)

    const insertTask = db.prepare(
      'INSERT INTO tasks (title, folder_id, parent_id, due_date, notes) VALUES (?, ?, ?, ?, ?)'
    )
    const getTask = db.prepare(`${SELECT_TASK_FIELDS} WHERE t.id = ?`)

    const created = db.transaction(() =>
      subtasks.map((st) => {
        const result = insertTask.run(
          st.title,
          parent.folder_id,
          parent_id,
          st.due_date ?? null,
          st.notes ?? null
        )
        return rowToTask(getTask.get(result.lastInsertRowid) as Record<string, unknown>)
      })
    )()

    return created
  })
}
