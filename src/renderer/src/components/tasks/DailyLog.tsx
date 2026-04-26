import { useState, useEffect } from 'react'
import { format, addDays, subDays, isToday, isYesterday } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task } from '@shared/types'
import { useAppStore } from '../../store/app'

const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => <h1 className="text-sm font-bold mt-2 mb-1 text-gray-900 dark:text-gray-100">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-semibold mt-2 mb-0.5 text-gray-900 dark:text-gray-100">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-semibold mt-1.5 mb-0.5 text-gray-800 dark:text-gray-200">{children}</h3>,
  p: ({ children }) => <p className="text-sm mb-1.5 last:mb-0 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="text-sm list-disc list-outside pl-4 mb-1.5 space-y-0.5 text-gray-700 dark:text-gray-300">{children}</ul>,
  ol: ({ children }) => <ol className="text-sm list-decimal list-outside pl-4 mb-1.5 space-y-0.5 text-gray-700 dark:text-gray-300">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300">{children}</a>,
  code: ({ children, className }) => className
    ? <code className="block text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded font-mono overflow-x-auto mb-1.5 text-gray-800 dark:text-gray-200">{children}</code>
    : <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono text-gray-800 dark:text-gray-200">{children}</code>,
  pre: ({ children }) => <pre className="mb-1.5">{children}</pre>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 my-1.5 text-gray-600 dark:text-gray-400 italic">{children}</blockquote>,
  hr: () => <hr className="border-gray-200 dark:border-gray-700 my-2" />,
  table: ({ children }) => <div className="overflow-x-auto mb-1.5"><table className="text-xs border-collapse w-full">{children}</table></div>,
  th: ({ children }) => <th className="text-left border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-800 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{children}</td>,
}

function formatDateLabel(date: Date): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMMM d, yyyy')
}

export default function DailyLog() {
  const { selectTask } = useAppStore()
  const [date, setDate] = useState<Date>(new Date())
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const dateStr = format(date, 'yyyy-MM-dd')
        const result = await window.api.tasks.listByCompletedDate(dateStr)
        setTasks(result)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [date])

  const isFuture = date > new Date()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Date navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <button
          onClick={() => setDate((d) => subDays(d, 1))}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
          aria-label="Previous day"
        >
          ‹
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {formatDateLabel(date)}
          </span>
          <input
            type="date"
            value={format(date, 'yyyy-MM-dd')}
            onChange={(e) => e.target.value && setDate(new Date(e.target.value + 'T00:00:00'))}
            className="text-xs text-gray-400 bg-transparent outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>

        <button
          onClick={() => setDate((d) => addDays(d, 1))}
          disabled={isFuture}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-30 transition-colors"
          aria-label="Next day"
        >
          ›
        </button>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {loading && (
          <div className="flex items-center justify-center h-24">
            <span className="text-sm text-gray-400">Loading…</span>
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <span className="text-2xl">📭</span>
            <p className="text-sm text-gray-400 dark:text-gray-600">
              No completed tasks on this day.
            </p>
          </div>
        )}

        {!loading && tasks.map((task) => (
          <div key={task.id} className="space-y-1.5">
            <button
              onClick={() => selectTask(task.id)}
              className="flex items-center gap-2 text-left group"
            >
              <span className="text-green-500 text-sm">✓</span>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-through decoration-gray-400">
                {task.title}
              </span>
              {task.completed_at && (
                <span className="text-xs text-gray-400 dark:text-gray-600">
                  {format(new Date(task.completed_at * 1000), 'h:mm a')}
                </span>
              )}
            </button>

            {task.notes && (
              <div className="pl-5 border-l-2 border-gray-100 dark:border-gray-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {task.notes}
                </ReactMarkdown>
              </div>
            )}

            {!task.notes && (
              <p className="pl-5 text-xs text-gray-400 dark:text-gray-600 italic">No notes</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
