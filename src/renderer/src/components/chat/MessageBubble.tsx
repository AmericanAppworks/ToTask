import ToolCallBubble from './ToolCallBubble'

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  result: unknown
  isError: boolean
}

export interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls: ToolCall[]
  isStreaming: boolean
  timestamp: number
}

interface Props {
  message: UIMessage
}

export default function MessageBubble({ message }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-tr-sm bg-blue-600 text-white text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col mb-3 items-start">
      {message.toolCalls.map((tc) => (
        <ToolCallBubble key={tc.id} tool={tc} />
      ))}
      {message.content && (
        <div className="max-w-[90%] px-3 py-2 rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-gray-400 dark:bg-gray-500 ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>
      )}
      {!message.content && message.isStreaming && (
        <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-800">
          <span className="flex gap-1">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </span>
        </div>
      )}
    </div>
  )
}
