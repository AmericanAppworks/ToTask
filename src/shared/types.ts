export interface Folder {
  id: number
  name: string
  created_at: number
}

export interface Task {
  id: number
  folder_id: number | null
  parent_id: number | null
  title: string
  notes: string | null
  due_date: string | null
  completed: boolean
  completed_at: number | null
  archived: boolean
  created_at: number
  updated_at: number
  tags: string[]
  subtask_count: number
  incomplete_subtask_count: number
  sort_order: number
}

export interface TaskFilters {
  completed?: boolean
  tag?: string
  due_before?: string
  due_after?: string
  parent_id?: number | null
  showParents?: boolean
}

export interface CreateTaskInput {
  title: string
  folder_id?: number | null
  parent_id?: number | null
  due_date?: string | null
  notes?: string | null
  tags?: string[]
}

export interface UpdateTaskInput {
  title?: string
  folder_id?: number | null
  parent_id?: number | null
  due_date?: string | null
  notes?: string | null
  tags?: string[]
  sort_order?: number
}

export interface SplitTaskInput {
  parent_id: number
  subtasks: Array<{
    title: string
    due_date?: string | null
    notes?: string | null
  }>
}

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_use_id: string | null
  created_at: number
}

export interface Conversation {
  id: number
  created_at: number
}

export type SmartList = 'inbox' | 'today' | 'upcoming' | 'all' | 'daily-log'
