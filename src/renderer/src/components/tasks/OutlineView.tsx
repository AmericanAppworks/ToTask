import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskFilters } from '@shared/types'
import { useAppStore, type ViewSelection } from '../../store/app'
import { format, addDays } from 'date-fns'

// ── Tree types ────────────────────────────────────────────────────────────────

interface TreeNode extends Task {
  children: TreeNode[]
}

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


function getNotePreview(notes: string | null): string[] {
  if (!notes) return []
  return notes
    .split('\n')
    .map(l =>
      l
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim()
    )
    .filter(l => l.length > 0)
    .slice(0, 3)
}

function viewToFilters(view: ViewSelection): { folderId?: number | null; filters: TaskFilters } {
  const today = format(new Date(), 'yyyy-MM-dd')
  const filters: TaskFilters = { showParents: true }
  if (view === 'inbox') return { folderId: null, filters }
  if (view === 'today') return { folderId: undefined, filters: { ...filters, due_before: today, completed: false } }
  if (view === 'upcoming') return {
    folderId: undefined,
    filters: { ...filters, due_after: format(addDays(new Date(), 1), 'yyyy-MM-dd'), due_before: format(addDays(new Date(), 7), 'yyyy-MM-dd'), completed: false }
  }
  if (view === 'all' || view === 'daily-log') return { folderId: undefined, filters }
  return { folderId: view as number, filters }
}

// ── Flat node for DnD ─────────────────────────────────────────────────────────

interface FlatNode {
  node: TreeNode
  depth: number
  parentId: number | null
}

// ── SortableItem ──────────────────────────────────────────────────────────────

interface ItemProps {
  flat: FlatNode
  hasChildren: boolean
  expanded: boolean
  isDragOverlay?: boolean
  onToggle: (id: number) => void
  onComplete: (id: number, completed: boolean) => void
  onSelect: (id: number) => void
}

function OutlineRow({ flat, hasChildren, expanded, isDragOverlay, onToggle, onComplete, onSelect }: ItemProps) {
  const { node, depth } = flat
  const [hovering, setHovering] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const noteLines = getNotePreview(node.notes)

  // bullet symbol
  let bulletSymbol = '•'
  if (hasChildren) bulletSymbol = hovering ? (expanded ? '−' : '+') : '•'

  const handleBulletClick = () => {
    if (hasChildren) {
      onToggle(node.id)
    } else {
      onComplete(node.id, !node.completed)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? {} : style}
      className={`select-none ${isDragOverlay ? 'shadow-lg rounded bg-white dark:bg-gray-900 opacity-95' : ''}`}
    >
      <div
        className="flex items-start gap-0 group py-0.5"
        style={{ paddingLeft: depth * 24 }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {/* Drag handle — appears on hover */}
        <span
          {...attributes}
          {...listeners}
          className="w-4 shrink-0 mt-0.5 text-gray-300 dark:text-gray-700 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-xs leading-5 select-none"
        >
          ⠿
        </span>

        {/* Bullet */}
        <button
          onClick={handleBulletClick}
          className={`w-5 shrink-0 mt-0.5 text-sm leading-5 transition-colors select-none ${
            node.completed
              ? 'text-gray-400 dark:text-gray-600'
              : hasChildren
                ? 'text-gray-400 dark:text-gray-500 hover:text-blue-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-green-500'
          }`}
          title={hasChildren ? (expanded ? 'Collapse' : 'Expand') : (node.completed ? 'Reopen' : 'Complete')}
        >
          {bulletSymbol}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-4">
          <button
            onClick={() => onSelect(node.id)}
            className={`text-left w-full text-sm leading-5 transition-colors ${
              node.completed
                ? 'line-through text-gray-400 dark:text-gray-600'
                : 'text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            {node.title}
          </button>

          {noteLines.length > 0 && (
            <div className="mt-0.5 space-y-0">
              {noteLines.map((line, i) => (
                <p key={i} className="text-xs text-gray-400 dark:text-gray-500 leading-4 truncate">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Children container with connecting line ───────────────────────────────────

function ChildrenContainer({ children, depth }: { children: React.ReactNode; depth: number }) {
  // Line aligned with bullet midpoint of parent (4px drag handle + 2.5px = ~7px, but visually we want
  // it under the bullet center which is at depth*24 + 4 + 2.5 = depth*24 + 6.5px from left)
  const lineLeft = depth * 24 + 4 + 9 // drag(16) + half of bullet(10) — in px from left
  return (
    <div className="relative">
      <div
        className="absolute top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700"
        style={{ left: lineLeft }}
      />
      {children}
    </div>
  )
}

// ── OutlineLevel — one sortable group of siblings ─────────────────────────────

interface LevelProps {
  nodes: TreeNode[]
  depth: number
  expanded: Set<number>
  onToggle: (id: number) => void
  onComplete: (id: number, completed: boolean) => void
  onSelect: (id: number) => void
  onReorder: (parentId: number | null, newOrder: TreeNode[]) => void
  parentId: number | null
}

function OutlineLevel({ nodes, depth, expanded, onToggle, onComplete, onSelect, onReorder, parentId }: LevelProps) {
  const ids = nodes.map(n => n.id)

  return (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {nodes.map(node => (
        <div key={node.id}>
          <OutlineRow
            flat={{ node, depth, parentId }}
            hasChildren={node.children.length > 0}
            expanded={expanded.has(node.id)}
            onToggle={onToggle}
            onComplete={onComplete}
            onSelect={onSelect}
          />
          {node.children.length > 0 && expanded.has(node.id) && (
            <ChildrenContainer depth={depth}>
              <OutlineLevel
                nodes={node.children}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                onComplete={onComplete}
                onSelect={onSelect}
                onReorder={onReorder}
                parentId={node.id}
              />
            </ChildrenContainer>
          )}
        </div>
      ))}
    </SortableContext>
  )
}

// ── Main OutlineView ──────────────────────────────────────────────────────────

export default function OutlineView() {
  const { selectedView, selectTask, completeTask } = useAppStore()
  const [roots, setRoots] = useState<TreeNode[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [activeId, setActiveId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  )

  const load = useCallback(async () => {
    const { folderId, filters } = viewToFilters(selectedView)
    const tasks = await window.api.tasks.list(folderId, filters)
    setAllTasks(tasks)
    const tree = buildTree(tasks)
    setRoots(tree)
    // Auto-expand all by default
    setExpanded(prev => {
      const next = new Set(prev)
      tasks.forEach(t => { if (t.incomplete_subtask_count > 0 || t.subtask_count > 0) next.add(t.id) })
      return next
    })
  }, [selectedView])

  useEffect(() => { load() }, [load])

  function handleToggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleComplete(id: number, completed: boolean) {
    await completeTask(id, completed)
    await load()
  }

  // Find which level (parent group) a task ID belongs to
  function findSiblings(id: number, nodes: TreeNode[]): TreeNode[] | null {
    for (const n of nodes) {
      if (n.id === id) return nodes
      const found = findSiblings(id, n.children)
      if (found) return found
    }
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const activeId = active.id as number
    const overId = over.id as number

    // Find the sibling group containing activeId
    const siblings = findSiblings(activeId, roots)
    if (!siblings) return

    // Check that over is in the same sibling group
    const overInSiblings = siblings.some(n => n.id === overId)
    if (!overInSiblings) return

    const oldIndex = siblings.findIndex(n => n.id === activeId)
    const newIndex = siblings.findIndex(n => n.id === overId)
    if (oldIndex === newIndex) return

    const reordered = arrayMove(siblings, oldIndex, newIndex)
    const orderedIds = reordered.map(n => n.id)

    // Optimistic update
    setRoots(prev => {
      function applyReorder(nodes: TreeNode[]): TreeNode[] {
        if (nodes === siblings) return reordered
        return nodes.map(n => ({ ...n, children: applyReorder(n.children) }))
      }
      return applyReorder(prev)
    })

    await window.api.tasks.reorder(orderedIds)
    await load()
  }

  const activeTask = activeId ? allTasks.find(t => t.id === activeId) : null
  const activeFlatNode: FlatNode | null = activeTask
    ? { node: { ...activeTask, children: [] }, depth: 0, parentId: activeTask.parent_id }
    : null

  if (roots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="text-2xl">✓</span>
        <p className="text-sm text-gray-400 dark:text-gray-600 text-center">No tasks here</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <OutlineLevel
          nodes={roots}
          depth={0}
          expanded={expanded}
          onToggle={handleToggle}
          onComplete={handleComplete}
          onSelect={selectTask}
          onReorder={() => {}}
          parentId={null}
        />
        <DragOverlay>
          {activeFlatNode && (
            <OutlineRow
              flat={activeFlatNode}
              hasChildren={false}
              expanded={false}
              isDragOverlay
              onToggle={() => {}}
              onComplete={() => {}}
              onSelect={() => {}}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
