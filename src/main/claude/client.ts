import Anthropic from '@anthropic-ai/sdk'
import type { BrowserWindow } from 'electron'
import type Database from 'better-sqlite3'
import { TOOL_DEFINITIONS } from './toolDefs'
import { executeTool } from '../mcp/tools'
import type { Task } from '../../shared/types'

function buildSystem(): string {
  const today = new Date().toISOString().split('T')[0]
  return `You are a task management assistant integrated into ToTask, a personal to-do app.
You have tools to create, read, update, complete, delete, and split tasks and folders.
You also have a web_search tool for real-time research.
When the user describes something they need to do, create a task for it.
Infer due dates from natural language ("before Friday" → nearest upcoming Friday, "next week" → Monday of next week).
When breaking down a complex task, use split_task to create subtasks atomically.
Confirm actions concisely after completing them. Ask for clarification only when truly ambiguous.
Task notes support full Markdown — always use it: headings, bold, bullet lists, numbered lists, links, tables, code blocks. Plain text is discouraged in notes.
For tasks that require research (finding nearby places, looking up current facts, checking hours/availability):
- Use web_search autonomously to gather the information.
- Call update_task to store your findings in the notes field using well-structured Markdown (headings, links, bullet lists).
- Then call complete_task to mark the task done.
- Summarize your findings for the user.
Today's date: ${today}.`
}

function buildUserContent(message: string, taskContext?: Task | null): string {
  if (!taskContext) return message
  const parts = [`[Task context — #${taskContext.id}: "${taskContext.title}"`]
  if (taskContext.due_date) parts.push(`, due ${taskContext.due_date}`)
  if (taskContext.notes) parts.push(`, notes: "${taskContext.notes}"`)
  if (taskContext.tags.length) parts.push(`, tags: ${taskContext.tags.join(', ')}`)
  if (taskContext.subtask_count > 0) parts.push(`, subtasks: ${taskContext.subtask_count - taskContext.incomplete_subtask_count}/${taskContext.subtask_count} done`)
  parts.push(']')
  return `${parts.join('')}\n\n${message}`
}

const MUTATING_TOOLS = new Set([
  'create_task', 'update_task', 'complete_task', 'delete_task', 'split_task',
  'create_folder', 'delete_folder'
])

export async function runConversation(
  apiKey: string,
  conversationId: number,
  userMessage: string,
  db: Database.Database,
  win: BrowserWindow,
  taskContext?: Task | null
): Promise<void> {
  const client = new Anthropic({ apiKey })

  // Save user message
  const userContent = buildUserContent(userMessage, taskContext)
  db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(
    conversationId, 'user', userContent
  )

  // Reconstruct API messages from DB history (all messages, including tool rounds)
  type DbMsg = { role: string; content: string }
  const dbMsgs = db
    .prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conversationId) as DbMsg[]

  const messages: Anthropic.MessageParam[] = dbMsgs.map((m) => {
    let content: Anthropic.MessageParam['content']
    try {
      const parsed = JSON.parse(m.content)
      content = parsed
    } catch {
      content = m.content
    }
    return { role: m.role as 'user' | 'assistant', content }
  })

  // Run the tool loop
  while (true) {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: buildSystem(),
      messages,
      tools: [...TOOL_DEFINITIONS, { type: 'web_search_20250305', name: 'web_search' } as Anthropic.WebSearchTool20250305]
    })

    stream.on('text', (text) => {
      win.webContents.send('chat:chunk', text)
    })

    stream.on('contentBlock', (block) => {
      if (block.type === 'server_tool_use') {
        win.webContents.send('chat:toolCall', {
          id: block.id,
          name: block.name,
          input: block.input,
          result: null,
          isError: false
        })
      }
    })

    const final = await stream.finalMessage()

    // Persist assistant turn
    const contentToSave =
      final.content.length === 1 && final.content[0].type === 'text'
        ? final.content[0].text
        : JSON.stringify(final.content)
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(
      conversationId, 'assistant', contentToSave
    )

    messages.push({ role: 'assistant', content: final.content })

    if (final.stop_reason !== 'tool_use') break

    // Execute client-side tools (skip server_tool_use — Anthropic handles those)
    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of final.content) {
      if (block.type !== 'tool_use') continue

      let result: unknown
      let isError = false
      try {
        result = executeTool(block.name, block.input as Record<string, unknown>)
      } catch (e) {
        result = e instanceof Error ? e.message : 'Tool execution failed'
        isError = true
      }

      win.webContents.send('chat:toolCall', {
        id: block.id,
        name: block.name,
        input: block.input,
        result,
        isError
      })

      if (!isError && MUTATING_TOOLS.has(block.name)) {
        try {
          if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
            win.webContents.send('tasks:changed')
          }
        } catch {
          // Best-effort renderer notification; ignore if the window closed mid-conversation.
        }
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
        ...(isError ? { is_error: true } : {})
      })
    }

    // Persist tool results round
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(
      conversationId, 'user', JSON.stringify(toolResults)
    )

    messages.push({ role: 'user', content: toolResults })
  }
}
