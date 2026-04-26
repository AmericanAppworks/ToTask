import type { Task } from '@shared/types'

interface Props {
  task: Task
  onDismiss: () => void
}

export default function TaskContextChip({ task, onDismiss }: Props) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 mx-3 mb-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-700 dark:text-blue-300">
      <span className="shrink-0">📎</span>
      <span className="flex-1 truncate font-medium">{task.title}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 text-blue-400 hover:text-blue-700 dark:hover:text-blue-200 leading-none ml-1"
      >
        ×
      </button>
    </div>
  )
}
