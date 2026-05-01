import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useAppStore } from '../../store/app'
import TaskRow from './TaskRow'

interface Props {
  onSelectTask: (id: number | null) => void
  selectedTaskId: number | null
}

export default function TaskList({ onSelectTask, selectedTaskId }: Props) {
  const { tasks, isLoadingTasks, selectedView, folders, createTask, completeTask, showParentTasks, setShowParentTasks, archiveCompletedTasks } = useAppStore()
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  function getViewLabel(): string {
    if (selectedView === 'inbox') return 'Inbox'
    if (selectedView === 'today') return 'Today'
    if (selectedView === 'upcoming') return 'Upcoming'
    if (selectedView === 'all') return 'All Tasks'
    const folder = folders.find((f) => f.id === selectedView)
    return folder?.name ?? 'Tasks'
  }

  function getFolderIdForNew(): number | null | undefined {
    if (typeof selectedView === 'number') return selectedView
    return undefined
  }

  async function handleAddTask() {
    const title = newTitle.trim()
    if (!title) { setAdding(false); return }
    await createTask({ title, folder_id: getFolderIdForNew() })
    setNewTitle('')
    setAdding(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAddTask()
    else if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
  }

  async function handleArchiveConfirm() {
    try {
      await archiveCompletedTasks()
      setShowArchiveConfirm(false)
    } catch (error) {
      console.error('Failed to archive completed tasks:', error)
      window.alert('Failed to archive completed tasks. Please try again.')
    }
  }

  const incomplete = tasks.filter((t) => !t.completed)
  const completed = tasks.filter((t) => t.completed)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{getViewLabel()}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowParentTasks(!showParentTasks)}
            title={showParentTasks ? 'Hide parent tasks' : 'Show parent tasks'}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              showParentTasks
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
            }`}
          >
            Parents
          </button>
          <button
            onClick={() => setAdding(true)}
            className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            + New
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {/* Quick-add input */}
        {adding && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <div className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600" />
            <input
              ref={inputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleAddTask}
              placeholder="New task title…"
              className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>
        )}

        {isLoadingTasks && tasks.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-gray-400">Loading…</span>
          </div>
        )}

        {/* Incomplete tasks */}
        {incomplete.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            isSelected={task.id === selectedTaskId}
            onSelect={() => onSelectTask(task.id === selectedTaskId ? null : task.id)}
            onComplete={(c) => completeTask(task.id, c)}
          />
        ))}

        {/* Completed tasks */}
        {completed.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wide">
                Completed
              </span>
              <button
                onClick={() => setShowArchiveConfirm(true)}
                className="text-xs text-gray-400 dark:text-gray-600 hover:text-amber-600 dark:hover:text-amber-500 transition-colors"
                title="Archive all completed tasks"
              >
                Archive
              </button>
            </div>
            {completed.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={task.id === selectedTaskId}
                onSelect={() => onSelectTask(task.id === selectedTaskId ? null : task.id)}
                onComplete={(c) => completeTask(task.id, c)}
              />
            ))}
          </>
        )}

        {/* Empty state */}
        {!isLoadingTasks && !adding && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-2xl">✓</span>
            <p className="text-sm text-gray-400 dark:text-gray-600">Nothing here</p>
            <button
              onClick={() => setAdding(true)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Add a task
            </button>
          </div>
        )}
      </div>

      {/* Archive confirmation dialog */}
      {showArchiveConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setShowArchiveConfirm(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-dialog-title"
            aria-describedby="archive-dialog-desc"
            className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-5 w-80 space-y-3"
            onKeyDown={(e) => { if (e.key === 'Escape') setShowArchiveConfirm(false) }}
          >
            <h3 id="archive-dialog-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">Archive completed tasks?</h3>
            <p id="archive-dialog-desc" className="text-xs text-gray-500 dark:text-gray-400">
              All completed tasks will be archived and hidden from every view except the Daily Log. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowArchiveConfirm(false)}
                className="text-xs px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                className="text-xs px-3 py-1.5 rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
