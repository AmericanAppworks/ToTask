import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useAppStore, type ViewSelection } from '../../store/app'
import type { Folder } from '@shared/types'
import SettingsModal from './SettingsModal'

const SMART_LISTS: { id: ViewSelection; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: '📥' },
  { id: 'today', label: 'Today', icon: '☀️' },
  { id: 'upcoming', label: 'Upcoming', icon: '📅' },
  { id: 'all', label: 'All Tasks', icon: '📋' },
  { id: 'daily-log', label: 'Daily Log', icon: '📓' }
]

function FolderItem({
  folder,
  isSelected,
  onSelect,
  onRename,
  onDelete
}: {
  folder: Folder
  isSelected: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(folder.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function commit() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== folder.name) onRename(trimmed)
    else setName(folder.name)
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commit()
    else if (e.key === 'Escape') { setName(folder.name); setEditing(false) }
  }

  return (
    <div
      onClick={onSelect}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
        isSelected
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
      }`}
    >
      <span className="text-xs">📁</span>
      {editing ? (
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-sm bg-transparent outline-none border-b border-blue-400"
        />
      ) : (
        <span className="flex-1 text-sm truncate">{folder.name}</span>
      )}
      {!editing && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-xs leading-none transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { folders, selectedView, selectView, createFolder, updateFolder, deleteFolder } = useAppStore()
  const [addingFolder, setAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addingFolder) folderInputRef.current?.focus()
  }, [addingFolder])

  async function handleAddFolder() {
    const name = newFolderName.trim()
    if (name) {
      const folder = await createFolder(name)
      await selectView(folder.id)
    }
    setNewFolderName('')
    setAddingFolder(false)
  }

  function handleFolderKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAddFolder()
    else if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName('') }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900/50 overflow-hidden">
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Drag region + app title (clears macOS traffic lights) */}
      <div
        className="flex items-end h-8 px-4 pb-1 shrink-0"
        style={{ WebkitAppRegion: 'drag', paddingLeft: 80 } as React.CSSProperties}
      >
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-500 select-none tracking-wide uppercase">
          ToTask
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Smart lists */}
        <div className="space-y-0.5 mb-4">
          {SMART_LISTS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => selectView(id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                selectedView === id
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="text-xs">{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Folders */}
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">
            Folders
          </span>
          <button
            onClick={() => setAddingFolder(true)}
            className="text-xs text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            +
          </button>
        </div>

        <div className="space-y-0.5">
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              isSelected={selectedView === folder.id}
              onSelect={() => selectView(folder.id)}
              onRename={(name) => updateFolder(folder.id, name)}
              onDelete={() => deleteFolder(folder.id)}
            />
          ))}

          {addingFolder && (
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className="text-xs">📁</span>
              <input
                ref={folderInputRef}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleFolderKeyDown}
                onBlur={handleAddFolder}
                placeholder="Folder name…"
                className="flex-1 text-sm bg-transparent outline-none border-b border-blue-400 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
            </div>
          )}

          {folders.length === 0 && !addingFolder && (
            <p className="px-2 text-xs text-gray-400 dark:text-gray-600 italic">No folders</p>
          )}
        </div>
      </nav>

      {/* Settings button */}
      <div className="shrink-0 px-3 py-2 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <span className="text-xs">⚙️</span>
          Settings
        </button>
      </div>
    </div>
  )
}
