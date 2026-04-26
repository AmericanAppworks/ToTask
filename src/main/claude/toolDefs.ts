import Anthropic from '@anthropic-ai/sdk'

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered. Returns an array of tasks with their tags and subtask counts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        folder_id: { type: 'number', description: 'Filter by folder ID' },
        tag: { type: 'string', description: 'Filter by tag name' },
        completed: { type: 'boolean', description: 'Filter by completion status' },
        due_before: { type: 'string', description: 'ISO date YYYY-MM-DD — return tasks due on or before this date (use for overdue/today queries)' },
        parent_id: { type: 'number', description: 'Return only direct subtasks of this task ID' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'get_task',
    description: 'Get a single task by ID, including its tags, subtask counts, and parent info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Task ID' }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'create_task',
    description: 'Create a new task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Task title (required)' },
        folder_id: { type: 'number', description: 'Folder ID to place the task in' },
        parent_id: { type: 'number', description: 'Parent task ID — makes this a subtask' },
        due_date: { type: 'string', description: 'Due date ISO format YYYY-MM-DD' },
        notes: { type: 'string', description: 'Additional notes' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tag strings' }
      },
      required: ['title'],
      additionalProperties: false
    }
  },
  {
    name: 'split_task',
    description: 'Break a task into concrete subtasks in one atomic call. Prefer this over multiple create_task calls when splitting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        parent_id: { type: 'number', description: 'The task ID to split (becomes the parent)' },
        subtasks: {
          type: 'array',
          description: 'The subtasks to create under the parent',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              due_date: { type: 'string' },
              notes: { type: 'string' }
            },
            required: ['title'],
            additionalProperties: false
          }
        }
      },
      required: ['parent_id', 'subtasks'],
      additionalProperties: false
    }
  },
  {
    name: 'update_task',
    description: 'Update one or more fields on an existing task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Task ID to update' },
        title: { type: 'string' },
        folder_id: { type: 'number' },
        due_date: { type: 'string', description: 'ISO date YYYY-MM-DD, or empty string to clear' },
        notes: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'complete_task',
    description: 'Mark a task as complete or reopen it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Task ID' },
        completed: { type: 'boolean', description: 'true to complete, false to reopen' }
      },
      required: ['id', 'completed'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_task',
    description: 'Permanently delete a task and all its subtasks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Task ID to delete' }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'list_folders',
    description: 'List all folders.',
    input_schema: { type: 'object' as const, properties: {}, additionalProperties: false }
  },
  {
    name: 'create_folder',
    description: 'Create a new folder.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Folder name' }
      },
      required: ['name'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_folder',
    description: 'Delete a folder. Tasks in the folder become unfoldered (moved to inbox).',
    input_schema: {
      type: 'object' as const,
      properties: {
        id: { type: 'number', description: 'Folder ID to delete' }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'list_tags',
    description: 'List all tags currently in use across all tasks.',
    input_schema: { type: 'object' as const, properties: {}, additionalProperties: false }
  }
]
