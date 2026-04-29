import {
  useState, useEffect, useLayoutEffect, useRef, useCallback, createContext, useContext,
  type KeyboardEvent
} from 'react'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskFilters } from '@shared/types'
import { useAppStore, type ViewSelection } from '../../store/app'
import { format, addDays } from 'date-fns'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TreeNode extends Task { children: TreeNode[] }

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTree(tasks: Task[]): TreeNode[] {
  const sorted = [...tasks].sort((a, b) => a.sort_order - b.sort_order || a.created_at - b.created_at)
  const byId = new Map<number, TreeNode>(sorted.map(t => [t.id, { ...t, children: [] }]))
  const roots: TreeNode[] = []
  for (const t of sorted) {
    const node = byId.get(t.id)!
    if (t.parent_id !== null && byId.has(t.parent_id)) {
      byId.get(t.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

function flattenIds(nodes: TreeNode[], expanded: Set<number>): number[] {
  return nodes.flatMap(n => [
    n.id,
    ...(n.children.length > 0 && expanded.has(n.id) ? flattenIds(n.children, expanded) : [])
  ])
}

function findNode(nodes: TreeNode[], id: number): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

function findSiblingList(nodes: TreeNode[], id: number): TreeNode[] | null {
  for (const n of nodes) {
    if (n.id === id) return nodes
    const found = findSiblingList(n.children, id)
    if (found) return found
  }
  return null
}

function getNotePreview(notes: string | null): string[] {
  if (!notes) return []
  return notes.split('\n')
    .map(l => l.replace(/^#{1,6}\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1')
                .replace(/\*([^*]+)\*/g, '$1').replace(/^[-*+]\s+/, '')
                .replace(/^\d+\.\s+/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/`([^`]+)`/g, '$1').trim())
    .filter(l => l.length > 0).slice(0, 3)
}

function viewToFilters(view: ViewSelection): { folderId?: number | null; filters: TaskFilters } {
  const today = format(new Date(), 'yyyy-MM-dd')
  const base: TaskFilters = { showParents: true }
  if (view === 'inbox') return { folderId: null, filters: base }
  if (view === 'today') return { folderId: undefined, filters: { ...base, due_before: today, completed: false } }
  if (view === 'upcoming') return { folderId: undefined, filters: { ...base,
    due_after: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    due_before: format(addDays(new Date(), 7), 'yyyy-MM-dd'), completed: false } }
  if (view === 'all' || view === 'daily-log') return { folderId: undefined, filters: base }
  return { folderId: view as number, filters: base }
}

// ── Context ───────────────────────────────────────────────────────────────────

interface Ctx {
  inputRefs: React.MutableRefObject<Map<number, HTMLInputElement>>
  editingNoteId: number | null
  expanded: Set<number>
  setEditingNoteId: (id: number | null) => void
  toggle: (id: number) => void
  saveTitle: (id: number, title: string) => Promise<void>
  saveNote: (id: number, notes: string) => Promise<void>
  complete: (id: number) => Promise<void>
  indent: (id: number) => Promise<void>
  unindent: (id: number) => Promise<void>
  createBelow: (id: number) => Promise<void>
  deleteIfEmpty: (id: number) => Promise<void>
  focusPrev: (id: number) => void
  focusNext: (id: number) => void
}

const OutlineCtx = createContext<Ctx>(null!)

// ── OutlineItem ───────────────────────────────────────────────────────────────

function OutlineItem({ node, depth }: { node: TreeNode; depth: number }) {
  const ctx = useContext(OutlineCtx)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })
  const [localTitle, setLocalTitle] = useState(node.title)
  const [localNote, setLocalNote] = useState(node.notes ?? '')
  const [hovering, setHovering] = useState(false)
  const isFocused = useRef(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const isEditingNote = ctx.editingNoteId === node.id

  // Sync title from server when not focused
  useEffect(() => {
    if (!isFocused.current) setLocalTitle(node.title)
  }, [node.title])

  // Sync note from server when not editing
  useEffect(() => {
    if (!isEditingNote) setLocalNote(node.notes ?? '')
  }, [node.notes, isEditingNote])

  // Focus note textarea when editing starts
  useLayoutEffect(() => {
    if (isEditingNote && noteRef.current) {
      noteRef.current.focus()
      const len = noteRef.current.value.length
      noteRef.current.setSelectionRange(len, len)
    }
  }, [isEditingNote])

  // Register input ref
  const inputCallbackRef = useCallback((el: HTMLInputElement | null) => {
    if (el) ctx.inputRefs.current.set(node.id, el)
    else ctx.inputRefs.current.delete(node.id)
  }, [node.id, ctx.inputRefs])

  const hasChildren = node.children.length > 0
  const isExpanded = ctx.expanded.has(node.id)

  function handleTitleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') {
      e.preventDefault()
      e.shiftKey ? ctx.unindent(node.id) : ctx.indent(node.id)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (e.metaKey) {
        ctx.complete(node.id)
      } else if (e.shiftKey) {
        ctx.setEditingNoteId(node.id)
      } else {
        ctx.saveTitle(node.id, localTitle).then(() => ctx.createBelow(node.id))
      }
    } else if (e.key === 'Backspace' && localTitle === '') {
      e.preventDefault()
      ctx.deleteIfEmpty(node.id)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      ctx.focusPrev(node.id)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      ctx.focusNext(node.id)
    } else if (e.key === 'Escape') {
      e.currentTarget.blur()
    }
  }

  function handleBulletClick() {
    if (hasChildren) ctx.toggle(node.id)
    else ctx.complete(node.id)
  }

  // Bullet label: • always; hover → + (expand) or − (collapse) when has children
  const bulletLabel = hasChildren && hovering ? (isExpanded ? '−' : '+') : '•'

  const noteLines = getNotePreview(node.notes)

  // Horizontal position where title starts (for note alignment)
  // depth*24 (indent) + 16 (drag) + 20 (bullet) = depth*24 + 36
  const contentLeft = depth * 24 + 36

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      {/* Item row */}
      <div
        className="flex items-start group py-[3px]"
        style={{ paddingLeft: depth * 24 }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="w-4 shrink-0 text-gray-300 dark:text-gray-700 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-xs leading-6 select-none"
        >
          ⠿
        </span>

        {/* Bullet / expand toggle */}
        <button
          onMouseDown={(e) => e.preventDefault()} // don't steal focus from input
          onClick={handleBulletClick}
          className={`w-5 shrink-0 text-sm leading-6 select-none transition-colors ${
            node.completed
              ? 'text-gray-400 dark:text-gray-600'
              : hasChildren
                ? 'text-gray-400 dark:text-gray-500 hover:text-blue-500'
                : 'text-gray-400 dark:text-gray-500 hover:text-green-500'
          }`}
        >
          {bulletLabel}
        </button>

        {/* Title input — always editable */}
        <input
          ref={inputCallbackRef}
          value={localTitle}
          onChange={e => setLocalTitle(e.target.value)}
          onBlur={() => { isFocused.current = false; ctx.saveTitle(node.id, localTitle) }}
          onFocus={() => { isFocused.current = true }}
          onKeyDown={handleTitleKeyDown}
          className={`flex-1 min-w-0 bg-transparent outline-none text-sm leading-6 pr-4 ${
            node.completed
              ? 'line-through text-gray-400 dark:text-gray-600'
              : 'text-gray-800 dark:text-gray-200'
          }`}
          placeholder="New task…"
          spellCheck
        />
      </div>

      {/* Note area */}
      {isEditingNote ? (
        <div style={{ paddingLeft: contentLeft }}>
          <textarea
            ref={noteRef}
            value={localNote}
            onChange={e => {
              setLocalNote(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onBlur={() => { ctx.saveNote(node.id, localNote); ctx.setEditingNoteId(null) }}
            onKeyDown={e => {
              if (e.key === 'Escape') { e.currentTarget.blur() }
              if (e.key === 'ArrowUp' && e.currentTarget.selectionStart === 0) {
                e.preventDefault()
                ctx.inputRefs.current.get(node.id)?.focus()
              }
            }}
            placeholder="Notes (markdown supported)…"
            rows={1}
            className="w-full bg-transparent outline-none resize-none text-xs text-gray-500 dark:text-gray-400 font-mono leading-5 placeholder-gray-300 dark:placeholder-gray-600 border-l-2 border-gray-200 dark:border-gray-700 pl-2 py-0.5 mb-1"
            style={{ height: 'auto', minHeight: 60 }}
          />
        </div>
      ) : noteLines.length > 0 ? (
        <div
          style={{ paddingLeft: contentLeft }}
          onClick={() => ctx.setEditingNoteId(node.id)}
          className="cursor-text mb-0.5 border-l-2 border-gray-100 dark:border-gray-800 pl-2"
        >
          {noteLines.map((line, i) => (
            <p key={i} className="text-xs text-gray-400 dark:text-gray-500 leading-[18px] truncate">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {/* Children with connecting line */}
      {hasChildren && isExpanded && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 pointer-events-none"
            style={{ left: depth * 24 + 26 }}
          />
          <SortableContext items={node.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {node.children.map(child => (
              <OutlineItem key={child.id} node={child} depth={depth + 1} />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  )
}

// ── OutlineView ───────────────────────────────────────────────────────────────

export default function OutlineView() {
  const { selectedView } = useAppStore()
  const [roots, setRoots] = useState<TreeNode[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)

  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const rootsRef = useRef<TreeNode[]>([])
  const expandedRef = useRef<Set<number>>(new Set())
  const allTasksRef = useRef<Map<number, Task>>(new Map())
  const pendingFocusId = useRef<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const load = useCallback(async () => {
    const { folderId, filters } = viewToFilters(selectedView)
    const tasks = await window.api.tasks.list(folderId, filters)
    setAllTasks(tasks)
    allTasksRef.current = new Map(tasks.map(t => [t.id, t]))
    const tree = buildTree(tasks)
    setRoots(tree)
    rootsRef.current = tree
    setExpanded(prev => {
      const next = new Set(prev)
      tasks.forEach(t => { if (t.subtask_count > 0) next.add(t.id) })
      expandedRef.current = next
      return next
    })
  }, [selectedView])

  useEffect(() => { load() }, [load])

  // Fire pending focus after roots update
  useEffect(() => {
    if (pendingFocusId.current) {
      const id = pendingFocusId.current
      pendingFocusId.current = null
      requestAnimationFrame(() => {
        const el = inputRefs.current.get(id)
        if (el) { el.focus(); el.setSelectionRange(0, 0) }
      })
    }
  }, [roots])

  // ── Handlers ────────────────────────────────────────────────────────────────

  const toggle = useCallback((id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      expandedRef.current = next
      return next
    })
  }, [])

  const saveTitle = useCallback(async (id: number, title: string) => {
    const task = allTasksRef.current.get(id)
    if (!task || title.trim() === task.title) return
    if (!title.trim()) return
    await window.api.tasks.update(id, { title: title.trim() })
    allTasksRef.current.set(id, { ...task, title: title.trim() })
  }, [])

  const saveNote = useCallback(async (id: number, notes: string) => {
    const task = allTasksRef.current.get(id)
    if (!task || notes === (task.notes ?? '')) return
    await window.api.tasks.update(id, { notes: notes || null })
    await load()
  }, [load])

  const complete = useCallback(async (id: number) => {
    const task = allTasksRef.current.get(id)
    if (!task) return
    await window.api.tasks.complete(id, !task.completed)
    await load()
    requestAnimationFrame(() => inputRefs.current.get(id)?.focus())
  }, [load])

  const indent = useCallback(async (id: number) => {
    const flat = flattenIds(rootsRef.current, expandedRef.current)
    const idx = flat.indexOf(id)
    if (idx <= 0) return
    const prevId = flat[idx - 1]
    const current = allTasksRef.current.get(id)!
    if (current.parent_id === prevId) return
    const prevNode = findNode(rootsRef.current, prevId)
    await window.api.tasks.update(id, {
      parent_id: prevId,
      folder_id: allTasksRef.current.get(prevId)?.folder_id ?? null,
      sort_order: (prevNode?.children.length ?? 0) * 1000,
    })
    // auto-expand the new parent
    setExpanded(prev => { const next = new Set(prev); next.add(prevId); expandedRef.current = next; return next })
    pendingFocusId.current = id
    await load()
  }, [load])

  const unindent = useCallback(async (id: number) => {
    const current = allTasksRef.current.get(id)
    if (!current || current.parent_id === null) return
    const parent = allTasksRef.current.get(current.parent_id)!
    const grandparentId = parent.parent_id
    const grandparentNode = grandparentId ? findNode(rootsRef.current, grandparentId) : null
    const gpChildren = grandparentNode ? grandparentNode.children : rootsRef.current
    const parentIdx = gpChildren.findIndex(n => n.id === parent.id)
    const newSiblingIds = [
      ...gpChildren.slice(0, parentIdx + 1).map(n => n.id),
      id,
      ...gpChildren.slice(parentIdx + 1).map(n => n.id),
    ]
    await window.api.tasks.update(id, {
      parent_id: grandparentId ?? null,
      folder_id: parent.folder_id,
    })
    await window.api.tasks.reorder(newSiblingIds)
    pendingFocusId.current = id
    await load()
  }, [load])

  const createBelow = useCallback(async (id: number) => {
    const current = allTasksRef.current.get(id)!
    const siblingList = findSiblingList(rootsRef.current, id) ?? rootsRef.current
    const idx = siblingList.findIndex(n => n.id === id)
    const newTask = await window.api.tasks.create({
      title: '',
      parent_id: current.parent_id,
      folder_id: current.folder_id,
    })
    const newSiblingIds = [
      ...siblingList.slice(0, idx + 1).map(n => n.id),
      newTask.id,
      ...siblingList.slice(idx + 1).map(n => n.id),
    ]
    await window.api.tasks.reorder(newSiblingIds)
    pendingFocusId.current = newTask.id
    await load()
  }, [load])

  const deleteIfEmpty = useCallback(async (id: number) => {
    const flat = flattenIds(rootsRef.current, expandedRef.current)
    const idx = flat.indexOf(id)
    const node = findNode(rootsRef.current, id)
    if (node && node.children.length > 0) return // don't delete parents
    if (idx > 0) {
      requestAnimationFrame(() => {
        const prevInput = inputRefs.current.get(flat[idx - 1])
        if (prevInput) { prevInput.focus(); const len = prevInput.value.length; prevInput.setSelectionRange(len, len) }
      })
    }
    await window.api.tasks.delete(id)
    await load()
  }, [load])

  const focusPrev = useCallback((id: number) => {
    const flat = flattenIds(rootsRef.current, expandedRef.current)
    const idx = flat.indexOf(id)
    if (idx > 0) {
      const el = inputRefs.current.get(flat[idx - 1])
      if (el) { el.focus(); const len = el.value.length; el.setSelectionRange(len, len) }
    }
  }, [])

  const focusNext = useCallback((id: number) => {
    const flat = flattenIds(rootsRef.current, expandedRef.current)
    const idx = flat.indexOf(id)
    if (idx >= 0 && idx < flat.length - 1) {
      const el = inputRefs.current.get(flat[idx + 1])
      if (el) { el.focus(); el.setSelectionRange(0, 0) }
    }
  }, [])

  // ── Drag and drop ────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const activeId = active.id as number
    const overId = over.id as number
    const siblings = findSiblingList(rootsRef.current, activeId)
    if (!siblings || !siblings.some(n => n.id === overId)) return
    const oldIdx = siblings.findIndex(n => n.id === activeId)
    const newIdx = siblings.findIndex(n => n.id === overId)
    if (oldIdx === newIdx) return
    const reordered = arrayMove(siblings, oldIdx, newIdx)
    // Optimistic
    setRoots(prev => {
      function apply(nodes: TreeNode[]): TreeNode[] {
        if (nodes === siblings) return reordered
        return nodes.map(n => ({ ...n, children: apply(n.children) }))
      }
      rootsRef.current = apply(prev)
      return rootsRef.current
    })
    await window.api.tasks.reorder(reordered.map(n => n.id))
    await load()
  }

  const activeTask = activeId ? allTasks.find(t => t.id === activeId) : null

  // ── Context value ────────────────────────────────────────────────────────────

  const ctx: Ctx = {
    inputRefs, editingNoteId, expanded,
    setEditingNoteId, toggle, saveTitle, saveNote, complete,
    indent, unindent, createBelow, deleteIfEmpty, focusPrev, focusNext,
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (roots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="text-2xl">✓</span>
        <p className="text-sm text-gray-400 dark:text-gray-600">No tasks here</p>
      </div>
    )
  }

  return (
    <OutlineCtx.Provider value={ctx}>
      <div className="h-full overflow-y-auto px-6 py-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={roots.map(n => n.id)} strategy={verticalListSortingStrategy}>
            {roots.map(node => <OutlineItem key={node.id} node={node} depth={0} />)}
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeTask && (
              <div className="bg-white dark:bg-gray-900 shadow-lg rounded px-2 py-1 text-sm text-gray-800 dark:text-gray-200 opacity-90">
                {activeTask.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </OutlineCtx.Provider>
  )
}
