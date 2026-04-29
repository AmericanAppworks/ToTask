import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../../store/app'
import TaskContextChip from './TaskContextChip'
import MessageBubble, { type UIMessage, type ToolCall } from './MessageBubble'
import ChatInput from './ChatInput'

type ApiKeyState = 'loading' | 'missing' | 'present'

function stripContextPrefix(content: string): string {
  return content.replace(/^\[Task context — #\d+:.*?\]\n\n/s, '')
}

function parseHistory(raw: { id: number; role: string; content: string; created_at: number }[]): UIMessage[] {
  return raw
    .filter((m) => {
      if (m.role !== 'user') return true
      try {
        const p = JSON.parse(m.content)
        return !(Array.isArray(p) && p[0]?.type === 'tool_result')
      } catch { return true }
    })
    .map((m) => {
      if (m.role === 'user') {
        return {
          id: String(m.id),
          role: 'user' as const,
          content: stripContextPrefix(m.content),
          toolCalls: [],
          isStreaming: false,
          timestamp: m.created_at
        }
      }
      let text = m.content
      try {
        const p = JSON.parse(m.content)
        if (Array.isArray(p)) {
          text = p.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('')
        }
      } catch { /* use raw */ }
      return {
        id: String(m.id),
        role: 'assistant' as const,
        content: text,
        toolCalls: [],
        isStreaming: false,
        timestamp: m.created_at
      }
    })
}

export default function ChatPanel() {
  const { chatTaskContext, setChatContext, loadTasks } = useAppStore()
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [apiKeyState, setApiKeyState] = useState<ApiKeyState>('loading')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pendingIdRef = useRef<string | null>(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Init: check API key and load/create conversation
  useEffect(() => {
    async function init() {
      const key = await window.api.settings.get('anthropic_api_key')
      if (!key) { setApiKeyState('missing'); return }
      setApiKeyState('present')
      await initConversation()
    }
    init()
  }, [])

  async function initConversation(forceNew = false) {
    let convId: number | null = null
    if (!forceNew) {
      const stored = await window.api.settings.get('active_conversation_id')
      if (stored) convId = parseInt(stored)
    }
    if (!convId) {
      const conv = await window.api.chat.newConversation()
      convId = conv.id
      await window.api.settings.set('active_conversation_id', String(convId))
    }
    setConversationId(convId)
    const history = await window.api.chat.history(convId)
    setMessages(parseHistory(history as Parameters<typeof parseHistory>[0]))
  }

  // Register error handler
  useEffect(() => {
    const off = window.api.chat.onError((error: string) => {
      if (error === 'NO_API_KEY') {
        setApiKeyState('missing')
      }
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.isStreaming) {
          const errText =
            error === 'NO_API_KEY'
              ? 'No API key configured. Use Settings in the sidebar to add one.'
              : `Error: ${error}`
          return [...prev.slice(0, -1), { ...last, content: errText, isStreaming: false }]
        }
        return prev
      })
      pendingIdRef.current = null
      setIsLoading(false)
    })
    return () => { off() }
  }, [])

  // Register streaming event listeners
  const handleChunk = useCallback((chunk: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.id === pendingIdRef.current) {
        return [...prev.slice(0, -1), { ...last, content: last.content + chunk }]
      }
      return prev
    })
  }, [])

  const handleToolCall = useCallback((tool: ToolCall) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last?.id === pendingIdRef.current) {
        return [...prev.slice(0, -1), { ...last, toolCalls: [...last.toolCalls, tool] }]
      }
      return prev
    })
    // Refresh task list so changes made by Claude appear immediately
    loadTasks()
  }, [loadTasks])

  useEffect(() => {
    const offChunk = window.api.chat.onChunk(handleChunk)
    const offTool = window.api.chat.onToolCall(handleToolCall as Parameters<typeof window.api.chat.onToolCall>[0])
    return () => { offChunk(); offTool() }
  }, [handleChunk, handleToolCall])

  async function handleSend() {
    const text = input.trim()
    if (!text || !conversationId || isLoading) return

    setInput('')
    setIsLoading(true)

    const userMsg: UIMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: chatTaskContext ? `📎 ${chatTaskContext.title}\n\n${text}` : text,
      toolCalls: [],
      isStreaming: false,
      timestamp: Date.now()
    }

    const pendingId = `a-${Date.now()}`
    pendingIdRef.current = pendingId
    const pendingMsg: UIMessage = {
      id: pendingId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      isStreaming: true,
      timestamp: Date.now()
    }

    setMessages((prev) => [...prev, userMsg, pendingMsg])

    try {
      await window.api.chat.send(text, conversationId, chatTaskContext ?? null)
    } catch { /* errors come via chat:error event */ } finally {
      setMessages((prev) =>
        prev.map((m) => m.id === pendingId ? { ...m, isStreaming: false } : m)
      )
      pendingIdRef.current = null
      setIsLoading(false)
      await loadTasks()
    }
  }

  async function handleSaveApiKey() {
    const key = apiKeyInput.trim()
    if (!key) return
    await window.api.settings.set('anthropic_api_key', key)
    setApiKeyInput('')
    setApiKeyState('present')
    await initConversation()
  }

  async function handleNewConversation() {
    await initConversation(true)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-8 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Claude
        </span>
        {apiKeyState === 'present' && (
          <button
            onClick={handleNewConversation}
            title="New conversation"
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            + New
          </button>
        )}
      </div>

      {/* API key setup */}
      {apiKeyState === 'missing' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <p className="text-sm text-center text-gray-600 dark:text-gray-400">
            Enter your Anthropic API key to enable Claude chat.
          </p>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
            placeholder="sk-ant-..."
            className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 outline-none text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          <button
            onClick={handleSaveApiKey}
            disabled={!apiKeyInput.trim()}
            className="w-full text-sm py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Save Key
          </button>
        </div>
      )}

      {/* Message list */}
      {apiKeyState === 'present' && (
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-2xl">✨</span>
              <p className="text-sm text-gray-400 dark:text-gray-600 text-center">
                Ask Claude to manage your tasks
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
                Select a task first to use it as context
              </p>
            </div>
          )}
          {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input area */}
      {apiKeyState === 'present' && (
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 pt-2 pb-3 px-3 space-y-2">
          {chatTaskContext && (
            <TaskContextChip task={chatTaskContext} onDismiss={() => setChatContext(null)} />
          )}
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            disabled={isLoading}
            placeholder={chatTaskContext ? `Ask about "${chatTaskContext.title}"…` : 'Ask Claude…'}
          />
        </div>
      )}
    </div>
  )
}
