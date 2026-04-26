import { format, isToday, isPast, differenceInCalendarDays, parseISO } from 'date-fns'
import type { Task } from '@shared/types'

interface Props {
  task: Task
  isSelected: boolean
  onSelect: () => void
  onComplete: (completed: boolean) => void
  compact?: boolean
}

function formatDue(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Today'
  const diff = differenceInCalendarDays(d, new Date())
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return format(d, 'EEE')
  return format(d, 'MMM d')
}

function dueDateClass(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isPast(d) && !isToday(d)) return 'text-red-500 dark:text-red-400'
  if (isToday(d)) return 'text-amber-600 dark:text-amber-500'
  if (differenceInCalendarDays(d, new Date()) <= 3) return 'text-blue-600 dark:text-blue-400'
  return 'text-gray-400 dark:text-gray-500'
}

export default function TaskRow({ task, isSelected, onSelect, onComplete, compact }: Props) {
  return (
    <div
      onClick={onSelect}
      className={`group flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-950/40'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onComplete(!task.completed) }}
        className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
          task.completed
            ? 'bg-green-500 border-green-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
        }`}
      >
        {task.completed && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug truncate ${
          task.completed ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-gray-100'
        }`}>
          {task.title}
        </p>

        {!compact && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {task.due_date && (
              <span className={`text-xs ${dueDateClass(task.due_date)}`}>
                {formatDue(task.due_date)}
              </span>
            )}
            {task.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-xs text-gray-400 dark:text-gray-500">
                #{tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-xs text-gray-400">+{task.tags.length - 2}</span>
            )}
            {task.subtask_count > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {task.subtask_count - task.incomplete_subtask_count}/{task.subtask_count}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
