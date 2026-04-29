import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import {
  listTasks, getTask, createTask, updateTask, completeTask, deleteTask, splitTask,
  listFolders, createFolder, deleteFolder, listTags
} from './tools'

let httpServer: http.Server | null = null

function buildMcpServer(): McpServer {
  const mcp = new McpServer({ name: 'totask', version: '0.1.0' })

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

  mcp.tool('list_tags', 'List all tags in use.', {}, () => ({
    content: [{ type: 'text' as const, text: JSON.stringify(listTags()) }]
  }))

  return mcp
}

export function startMcpServer(port: number): void {
  const sessions = new Map<string, StreamableHTTPServerTransport>()

  httpServer = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    const url = new URL(req.url ?? '/', `http://localhost:${port}`)
    if (url.pathname !== '/mcp') { res.writeHead(404); res.end('Not found'); return }

    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport = sessionId ? sessions.get(sessionId) : undefined

    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => { sessions.set(id, transport!) }
      })
      transport.onclose = () => {
        if (transport!.sessionId) sessions.delete(transport!.sessionId)
      }
      const mcp = buildMcpServer()
      await mcp.connect(transport)
    }

    let body: unknown
    if (req.method === 'POST') {
      body = await new Promise((resolve) => {
        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', () => { resolve(raw ? JSON.parse(raw) : undefined) })
      })
    }

    await transport.handleRequest(req, res, body)
  })

  httpServer.listen(port, () => {
    console.log(`[MCP] server listening on http://localhost:${port}/mcp`)
  })
}

export function stopMcpServer(): void {
  httpServer?.close()
  httpServer = null
}
