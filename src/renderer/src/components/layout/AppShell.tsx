import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import Sidebar from './Sidebar'
import TaskPane from '../tasks/TaskPane'

function ResizeHandle() {
  return (
    <PanelResizeHandle className="w-px bg-gray-200 dark:bg-gray-800 hover:bg-blue-400/50 active:bg-blue-500/60 transition-colors" />
  )
}

function ChatPlaceholder() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center h-8 px-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">
          Claude
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400 dark:text-gray-600">Chat — Phase 3</p>
      </div>
      <div className="p-3 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            disabled
            placeholder="Ask Claude…"
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none text-gray-400"
          />
          <button
            disabled
            className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AppShell() {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <Panel defaultSize={18} minSize={14} maxSize={30} id="sidebar" order={1}>
          <Sidebar />
        </Panel>
        <ResizeHandle />
        <Panel defaultSize={48} minSize={25} id="tasks" order={2}>
          <TaskPane />
        </Panel>
        <ResizeHandle />
        <Panel defaultSize={34} minSize={20} id="chat" order={3}>
          <ChatPlaceholder />
        </Panel>
      </PanelGroup>
    </div>
  )
}
