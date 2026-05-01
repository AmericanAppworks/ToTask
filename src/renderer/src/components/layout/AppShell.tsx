import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from './Sidebar'
import TaskPane from '../tasks/TaskPane'
import ChatPanel from '../chat/ChatPanel'
import { useAppStore } from '../../store/app'

function ResizeHandle() {
  return (
    <PanelResizeHandle className="w-px bg-gray-200 dark:bg-gray-800 hover:bg-blue-400/50 active:bg-blue-500/60 transition-colors" />
  )
}

export default function AppShell() {
  const showChatPanel = useAppStore((s) => s.showChatPanel)

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <Panel defaultSize={18} minSize={14} maxSize={30} id="sidebar" order={1}>
          <Sidebar />
        </Panel>
        <ResizeHandle />
        <Panel defaultSize={showChatPanel ? 48 : 82} minSize={25} id="tasks" order={2}>
          <TaskPane />
        </Panel>
        {showChatPanel && (
          <>
            <ResizeHandle />
            <Panel defaultSize={34} minSize={20} id="chat" order={3}>
              <ChatPanel />
            </Panel>
          </>
        )}
      </PanelGroup>
    </div>
  )
}
