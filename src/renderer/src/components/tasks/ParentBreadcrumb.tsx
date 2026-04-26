import { useEffect, useState } from 'react'
import type { Task } from '@shared/types'

interface Props {
  parentId: number
  onNavigate: (id: number) => void
}

export default function ParentBreadcrumb({ parentId, onNavigate }: Props) {
  const [parent, setParent] = useState<Task | null>(null)

  useEffect(() => {
    window.api.tasks.get(parentId).then(setParent).catch(() => setParent(null))
  }, [parentId])

  if (!parent) return null

  return (
    <button
      onClick={() => onNavigate(parentId)}
      className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2"
    >
      <span>↑</span>
      <span className="truncate max-w-xs">{parent.title}</span>
    </button>
  )
}
