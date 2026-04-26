interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result: unknown
  isError: boolean
}

function summarize(name: string, input: Record<string, unknown>, result: unknown): string {
  switch (name) {
    case 'create_task': {
      const r = result as { id?: number; title?: string }
      return `Created task #${r?.id ?? '?'}: "${r?.title ?? (input.title as string) ?? ''}"`
    }
    case 'split_task': {
      const r = result as unknown[]
      return `Split task #${input.parent_id} → ${Array.isArray(r) ? r.length : '?'} subtasks`
    }
    case 'update_task':
      return `Updated task #${input.id}`
    case 'complete_task': {
      const r = result as { completed?: boolean }
      return `${r?.completed ? 'Completed' : 'Reopened'} task #${input.id}`
    }
    case 'delete_task':
      return `Deleted task #${input.id}`
    case 'list_tasks': {
      const r = result as unknown[]
      return `Listed ${Array.isArray(r) ? r.length : '?'} tasks`
    }
    case 'get_task': {
      const r = result as { title?: string }
      return `Fetched task: "${r?.title ?? ''}"`
    }
    case 'create_folder': {
      const r = result as { name?: string }
      return `Created folder "${r?.name ?? (input.name as string) ?? ''}"`
    }
    case 'delete_folder':
      return `Deleted folder #${input.id}`
    case 'list_folders': {
      const r = result as unknown[]
      return `Listed ${Array.isArray(r) ? r.length : '?'} folders`
    }
    case 'list_tags': {
      const r = result as unknown[]
      return `Listed ${Array.isArray(r) ? r.length : '?'} tags`
    }
    default:
      return name
  }
}

export default function ToolCallBubble({ tool }: { tool: ToolCall }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded my-0.5 ${
      tool.isError
        ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
        : 'bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400'
    }`}>
      <span>{tool.isError ? '✗' : '⚙'}</span>
      <span>{summarize(tool.name, tool.input, tool.result)}</span>
    </div>
  )
}
