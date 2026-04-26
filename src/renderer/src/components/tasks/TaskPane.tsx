import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { useAppStore } from '../../store/app'
import TaskList from './TaskList'
import TaskDetail from './TaskDetail'

export default function TaskPane() {
  const { selectedTaskId, selectTask } = useAppStore()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {selectedTaskId ? (
        <PanelGroup direction="vertical">
          <Panel defaultSize={42} minSize={20}>
            <div className="h-full overflow-y-auto border-b border-gray-200 dark:border-gray-800">
              <TaskDetail
                taskId={selectedTaskId}
                onClose={() => selectTask(null)}
              />
            </div>
          </Panel>
          <PanelResizeHandle className="h-px bg-gray-200 dark:bg-gray-800 hover:bg-blue-400/50 transition-colors" />
          <Panel defaultSize={58} minSize={20}>
            <TaskList selectedTaskId={selectedTaskId} onSelectTask={selectTask} />
          </Panel>
        </PanelGroup>
      ) : (
        <TaskList selectedTaskId={null} onSelectTask={selectTask} />
      )}
    </div>
  )
}
