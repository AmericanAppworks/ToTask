import http from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { z } from 'zod'
import {
  listTasks, getTask, createTask, updateTask, completeTask, deleteTask, splitTask,
  listFolders, createFolder, deleteFolder, listTags
} from './tools'

let httpServer: http.Server | null = null

export function startMcpServer(port: number): void {
  const mcp = new McpServer({ name: 'totask', version: '0.1.0' })

  // ── Tasks ─────────────────────────────────────────────────────────────────

  mcp.tool('list_tasks', 'List tasks with optional filters.', {
    folder_id: z.number().optional(),
    tag: z.string().optional(),
    completed: z.boolean().optional(),
    due_before: z.string().optional(),
    parent_id: z.number().optional()
  }, ({ folder_id, tag, completed, due_before, parent_id }) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(listTasks({ folder_id, tag, completed, due_before, parent_id })) }]
  }))

  mcp.tool('get_task', 'Get a task by ID.', { id: z.number() }, ({ id }) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(getTask(id)) }]
  }))

  mcp.tool('create_task', 'Create a new task.', {
    title: z.string(),
    folder_id: z.number().optional(),
    parent_id: z.number().optional(),
    due_date: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional()
  }, (input) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(createTask(input)) }]
  }))

  mcp.tool('split_task', 'Split a task into subtasks atomically.', {
    parent_id: z.number(),
    subtasks: z.array(z.object({
      title: z.string(),
      due_date: z.string().optional(),
      notes: z.string().optional()
    }))
  }, ({ parent_id, subtasks }) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(splitTask(parent_id, subtasks)) }]
  }))

  mcp.tool('update_task', 'Update fields on a task.', {
    id: z.number(),
    title: z.string().optional(),
    folder_id: z.number().optional(),
    due_date: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional()
  }, ({ id, ...rest }) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(updateTask(id, rest)) }]
  }))

  mcp.tool('complete_task', 'Mark a task complete or incomplete.', {
    id: z.number(),
    completed: z.boolean()
  }, ({ id, completed }) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(completeTask(id, completed)) }]
  }))

  mcp.tool('delete_task', 'Delete a task and its subtasks.', { id: z.number() }, ({ id }) => {
    deleteTask(id)
    return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true }) }] }
  })

  // ── Folders ───────────────────────────────────────────────────────────────

  mcp.tool('list_folders', 'List all folders.', {}, () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(listFolders()) }]
  }))

  mcp.tool('create_folder', 'Create a folder.', { name: z.string() }, ({ name }) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(createFolder(name)) }]
  }))

  mcp.tool('delete_folder', 'Delete a folder (tasks become unfoldered).', { id: z.number() }, ({ id }) => {
    deleteFolder(id)
    return { content: [{ type: 'text' as const, text: JSON.stringify({ deleted: true }) }] }
  })

  // ── Tags ──────────────────────────────────────────────────────────────────

  mcp.tool('list_tags', 'List all tags in use.', {}, () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(listTags()) }]
  }))

  // ── HTTP/SSE server ───────────────────────────────────────────────────────

  const transports = new Map<string, SSEServerTransport>()

  httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-id')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    const url = new URL(req.url ?? '/', `http://localhost:${port}`)

    if (req.method === 'GET' && url.pathname === '/sse') {
      const transport = new SSEServerTransport('/message', res)
      transports.set(transport.sessionId, transport)
      res.on('close', () => transports.delete(transport.sessionId))
      mcp.connect(transport)
      return
    }

    if (req.method === 'POST' && url.pathname === '/message') {
      const sessionId = req.headers['x-session-id'] as string
      const transport = transports.get(sessionId)
      if (!transport) { res.writeHead(404); res.end('Session not found'); return }

      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        transport.handlePostMessage(req, res, body ? JSON.parse(body) : undefined)
      })
      return
    }

    res.writeHead(404)
    res.end('Not found')
  })

  httpServer.listen(port, () => {
    console.log(`[MCP] server listening on http://localhost:${port}/sse`)
  })
}

export function stopMcpServer(): void {
  httpServer?.close()
  httpServer = null
}
