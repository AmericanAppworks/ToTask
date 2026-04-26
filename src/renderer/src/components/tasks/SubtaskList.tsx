import { useEffect, useState, useRef, KeyboardEvent } from 'react'
import type { Task } from '@shared/types'
import TaskRow from './TaskRow'
import { useAppStore } from '../../store/app'

interface Props {
  parentId: number
  selectedTaskId: number | null
  onSelectTask: (id: number) => void
}

export default function SubtaskList({ parentId, selectedTaskId, onSelectTask }: Props) {
  const [subtasks, setSubtasks] = useState<Task[]>([])
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { completeTask, loadTasks } = useAppStore()

  async function load() {
    const tasks = await window.api.tasks.subtasks(parentId)
    setSubtasks(tasks)
  }

  useEffect(() => { load() }, [parentId])

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  async function handleAddSubtask() {
    const title = newTitle.trim()
    if (!title) { setAdding(false); return }
    const parent = await window.api.tasks.get(parentId)
    await window.api.tasks.create({ title, parent_id: parentId, folder_id: parent.folder_id })
    setNewTitle('')
    await load()
    await loadTasks()
  }

  async function handleComplete(id: number, completed: boolean) {
    await completeTask(id, completed)
    await load()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAddSubtask()
    else if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Subtasks
        </span>
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          + Add
        </button>
      </div>

      <div className="space-y-0.5">
        {subtasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            isSelected={task.id === selectedTaskId}
            onSelect={() => onSelectTask(task.id)}
            onComplete={(c) => handleComplete(task.id, c)}
            compact
          />
        ))}

        {adding && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="w-4 h-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600" />
            <input
              ref={inputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleAddSubtask}
              placeholder="Subtask title…"
              className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
          </div>
        )}

        {subtasks.length === 0 && !adding && (
          <p className="px-3 text-xs text-gray-400 dark:text-gray-600 italic">No subtasks yet</p>
        )}
      </div>
    </div>
  )
}
