import { useAppStore } from '../../store/app'
import TaskList from './TaskList'
import TaskDetail from './TaskDetail'
import DailyLog from './DailyLog'
import OutlineView from './OutlineView'

function TabButton({
  label,
  active,
  onClick,
  onClose,
}: {
  label: string
  active: boolean
  onClick: () => void
  onClose?: () => void
}) {
  return (
    <div
      className={`flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer select-none shrink-0 border-b-2 transition-colors ${
        active
          ? 'border-blue-500 text-gray-900 dark:text-gray-100 font-medium'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
      }`}
      onClick={onClick}
    >
      <span className="max-w-[120px] truncate">{label}</span>
      {onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="ml-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 leading-none"
          aria-label="Close tab"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default function TaskPane() {
  const { selectedTaskId, selectedView, viewMode, openTabIds, tabTitles, selectTask, closeTab, setViewMode } = useAppStore()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-end border-b border-gray-200 dark:border-gray-800 shrink-0 overflow-x-auto px-1 pt-1">
        <TabButton
          label="Tasks"
          active={selectedTaskId === null}
          onClick={() => selectTask(null)}
        />
        {openTabIds.map((id) => (
          <TabButton
            key={id}
            label={tabTitles[id] ?? `Task #${id}`}
            active={selectedTaskId === id}
            onClick={() => selectTask(id)}
            onClose={() => closeTab(id)}
          />
        ))}

        {/* View mode toggle — only on the Tasks tab, not daily-log */}
        {selectedTaskId === null && selectedView !== 'daily-log' && (
          <div className="ml-auto flex items-center gap-0.5 pb-1 pr-1">
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                viewMode === 'list'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              ☰
            </button>
            <button
              onClick={() => setViewMode('outline')}
              title="Outline view"
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                viewMode === 'outline'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              ⊞
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {selectedTaskId !== null ? (
          <div className="h-full overflow-y-auto">
            <TaskDetail taskId={selectedTaskId} onClose={() => closeTab(selectedTaskId)} />
          </div>
        ) : selectedView === 'daily-log' ? (
          <DailyLog />
        ) : viewMode === 'outline' ? (
          <OutlineView />
        ) : (
          <TaskList selectedTaskId={null} onSelectTask={selectTask} />
        )}
      </div>
    </div>
  )
}
