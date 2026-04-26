import type Database from 'better-sqlite3'
import type { Task } from '../../shared/types'

export const SELECT_TASK_FIELDS = `
  SELECT
    t.*,
    COALESCE(
      (SELECT GROUP_CONCAT(tag, ',') FROM task_tags WHERE task_id = t.id ORDER BY tag),
      ''
    ) as tags_raw,
    (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id) as subtask_count,
    (SELECT COUNT(*) FROM tasks WHERE parent_id = t.id AND completed = 0) as incomplete_subtask_count
  FROM tasks t
`

export function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.id as number,
    folder_id: row.folder_id as number | null,
    parent_id: row.parent_id as number | null,
    title: row.title as string,
    notes: row.notes as string | null,
    due_date: row.due_date as string | null,
    completed: Boolean(row.completed),
    completed_at: row.completed_at as number | null,
    created_at: row.created_at as number,
    updated_at: row.updated_at as number,
    tags: row.tags_raw ? (row.tags_raw as string).split(',').filter(Boolean) : [],
    subtask_count: row.subtask_count as number,
    incomplete_subtask_count: row.incomplete_subtask_count as number
  }
}

export function getTaskById(db: Database.Database, id: number): Task | undefined {
  const row = db
    .prepare(`${SELECT_TASK_FIELDS} WHERE t.id = ?`)
    .get(id) as Record<string, unknown> | undefined
  return row ? rowToTask(row) : undefined
}
