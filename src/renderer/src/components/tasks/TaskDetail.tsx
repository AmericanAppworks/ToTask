import { useEffect, useState, useRef } from 'react'
import type { Task, UpdateTaskInput } from '@shared/types'
import { useAppStore } from '../../store/app'
import TagInput from './TagInput'
import SubtaskList from './SubtaskList'
import ParentBreadcrumb from './ParentBreadcrumb'

interface Props {
  taskId: number
  onClose: () => void
}

export default function TaskDetail({ taskId, onClose }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const { updateTask, deleteTask, selectTask, completeTask } = useAppStore()
  const titleRef = useRef<HTMLInputElement>(null)
  const pendingUpdate = useRef<UpdateTaskInput>({})

  async function load(id: number) {
    const t = await window.api.tasks.get(id)
    setTask(t)
    setTitle(t.title)
    setDueDate(t.due_date ?? '')
    setNotes(t.notes ?? '')
    setTags(t.tags)
    pendingUpdate.current = {}
  }

  useEffect(() => { load(taskId) }, [taskId])

  async function flush() {
    if (Object.keys(pendingUpdate.current).length === 0) return
    await updateTask(taskId, pendingUpdate.current)
    pendingUpdate.current = {}
  }

  function markDirty(patch: UpdateTaskInput) {
    pendingUpdate.current = { ...pendingUpdate.current, ...patch }
  }

  async function handleTitleBlur() {
    const trimmed = title.trim()
    if (!trimmed || !task) return
    if (trimmed !== task.title) markDirty({ title: trimmed })
    await flush()
  }

  async function handleNotesBlur() {
    if (!task) return
    if (notes !== (task.notes ?? '')) markDirty({ notes: notes || null })
    await flush()
  }

  async function handleDueDateChange(value: string) {
    setDueDate(value)
    markDirty({ due_date: value || null })
    await flush()
  }

  async function handleTagsChange(newTags: string[]) {
    setTags(newTags)
    await updateTask(taskId, { tags: newTags })
  }

  async function handleDelete() {
    onClose()
    await deleteTask(taskId)
  }

  async function handleComplete() {
    if (!task) return
    await completeTask(taskId, !task.completed)
    await load(taskId)
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-gray-400">Loading…</span>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {task.parent_id && (
        <ParentBreadcrumb parentId={task.parent_id} onNavigate={selectTask} />
      )}

      {/* Title */}
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        placeholder="Task title"
        className={`w-full text-base font-medium bg-transparent outline-none border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600 pb-0.5 transition-colors ${
          task.completed
            ? 'line-through text-gray-400 dark:text-gray-600'
            : 'text-gray-900 dark:text-gray-100'
        }`}
      />

      {/* Due date */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 shrink-0">Due</span>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => handleDueDateChange(e.target.value)}
          className="text-sm bg-transparent outline-none text-gray-700 dark:text-gray-300 border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600 transition-colors [color-scheme:light] dark:[color-scheme:dark]"
        />
        {dueDate && (
          <button
            onClick={() => handleDueDateChange('')}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        )}
      </div>

      {/* Tags */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 shrink-0 pt-1.5">Tags</span>
        <div className="flex-1">
          <TagInput tags={tags} onChange={handleTagsChange} />
        </div>
      </div>

      {/* Notes */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 shrink-0 pt-1">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Add notes…"
          rows={3}
          className="flex-1 text-sm bg-transparent outline-none resize-none text-gray-700 dark:text-gray-300 placeholder-gray-400 border rounded border-transparent focus:border-gray-300 dark:focus:border-gray-600 transition-colors p-1"
        />
      </div>

      {/* Subtasks */}
      <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
        <SubtaskList
          parentId={taskId}
          selectedTaskId={null}
          onSelectTask={selectTask}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={handleComplete}
          className={`text-xs px-3 py-1.5 rounded transition-colors ${
            task.completed
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {task.completed ? '✓ Completed' : 'Mark complete'}
        </button>
        <button
          onClick={handleDelete}
          className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
