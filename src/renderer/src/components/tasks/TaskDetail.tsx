import { useEffect, useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task, UpdateTaskInput } from '@shared/types'
import { useAppStore } from '../../store/app'
import TagInput from './TagInput'
import SubtaskList from './SubtaskList'
import ParentBreadcrumb from './ParentBreadcrumb'

interface Props {
  taskId: number
  onClose: () => void
}

const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-1 text-gray-900 dark:text-gray-100">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold mt-2 mb-1 text-gray-900 dark:text-gray-100">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-0.5 text-gray-800 dark:text-gray-200">{children}</h3>,
  p: ({ children }) => <p className="text-sm mb-2 last:mb-0 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="text-sm list-disc list-outside pl-4 mb-2 space-y-0.5 text-gray-700 dark:text-gray-300">{children}</ul>,
  ol: ({ children }) => <ol className="text-sm list-decimal list-outside pl-4 mb-2 space-y-0.5 text-gray-700 dark:text-gray-300">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300">{children}</a>,
  code: ({ children, className }) => className
    ? <code className="block text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded font-mono overflow-x-auto mb-2 text-gray-800 dark:text-gray-200">{children}</code>
    : <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded font-mono text-gray-800 dark:text-gray-200">{children}</code>,
  pre: ({ children }) => <pre className="mb-2">{children}</pre>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 my-2 text-gray-600 dark:text-gray-400 italic">{children}</blockquote>,
  hr: () => <hr className="border-gray-200 dark:border-gray-700 my-3" />,
  table: ({ children }) => <div className="overflow-x-auto mb-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
  th: ({ children }) => <th className="text-left border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-800 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{children}</td>,
}

export default function TaskDetail({ taskId, onClose }: Props) {
  const [task, setTask] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [notesEditMode, setNotesEditMode] = useState(false)
  const { updateTask, deleteTask, selectTask, completeTask, setTabTitle } = useAppStore()
  const titleRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)
  const pendingUpdate = useRef<UpdateTaskInput>({})

  async function load(id: number) {
    const t = await window.api.tasks.get(id)
    setTask(t)
    setTitle(t.title)
    setDueDate(t.due_date ?? '')
    setNotes(t.notes ?? '')
    setTags(t.tags)
    setTabTitle(id, t.title)
    pendingUpdate.current = {}
  }

  useEffect(() => { load(taskId) }, [taskId])

  useEffect(() => {
    if (notesEditMode && notesRef.current) {
      notesRef.current.focus()
      autoResize(notesRef.current)
    }
  }, [notesEditMode])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

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
    if (trimmed !== task.title) {
      markDirty({ title: trimmed })
      setTabTitle(taskId, trimmed)
    }
    await flush()
  }

  async function handleNotesBlur() {
    if (!task) return
    if (notes !== (task.notes ?? '')) markDirty({ notes: notes || null })
    await flush()
    setNotesEditMode(false)
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
      <div className="flex items-center justify-center h-32">
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

      {/* Notes — rendered markdown or editable textarea */}
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400 w-12 shrink-0 pt-1">Notes</span>
        <div className="flex-1 min-w-0">
          {notesEditMode ? (
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); autoResize(e.target) }}
              onBlur={handleNotesBlur}
              placeholder="Add notes… (markdown supported)"
              className="w-full text-sm bg-transparent outline-none resize-none text-gray-700 dark:text-gray-300 placeholder-gray-400 border rounded border-gray-300 dark:border-gray-600 transition-colors p-1 font-mono leading-relaxed min-h-[80px]"
              style={{ height: 'auto' }}
            />
          ) : (
            <div
              onClick={() => setNotesEditMode(true)}
              className={`min-h-[32px] rounded px-1 py-0.5 cursor-text hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${
                notes ? '' : 'text-gray-400 text-sm'
              }`}
            >
              {notes ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {notes}
                </ReactMarkdown>
              ) : (
                <span className="text-sm">Add notes…</span>
              )}
            </div>
          )}
        </div>
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
