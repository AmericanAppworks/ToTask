import { contextBridge, ipcRenderer } from 'electron'
import type {
  Task,
  Folder,
  TaskFilters,
  CreateTaskInput,
  UpdateTaskInput,
  SplitTaskInput,
  Message,
  Conversation
} from '../shared/types'

const api = {
  tasks: {
    list: (folderId?: number | null, filters?: TaskFilters): Promise<Task[]> =>
      ipcRenderer.invoke('tasks:list', folderId, filters),
    get: (id: number): Promise<Task> => ipcRenderer.invoke('tasks:get', id),
    create: (input: CreateTaskInput): Promise<Task> => ipcRenderer.invoke('tasks:create', input),
    update: (id: number, input: UpdateTaskInput): Promise<Task> =>
      ipcRenderer.invoke('tasks:update', id, input),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('tasks:delete', id),
    complete: (id: number, completed: boolean): Promise<Task> =>
      ipcRenderer.invoke('tasks:complete', id, completed),
    subtasks: (parentId: number): Promise<Task[]> =>
      ipcRenderer.invoke('tasks:subtasks', parentId),
    split: (input: SplitTaskInput): Promise<Task[]> => ipcRenderer.invoke('tasks:split', input),
    listByCompletedDate: (date: string): Promise<Task[]> =>
      ipcRenderer.invoke('tasks:listByCompletedDate', date)
  },
  folders: {
    list: (): Promise<Folder[]> => ipcRenderer.invoke('folders:list'),
    create: (name: string): Promise<Folder> => ipcRenderer.invoke('folders:create', name),
    update: (id: number, name: string): Promise<Folder> =>
      ipcRenderer.invoke('folders:update', id, name),
    delete: (id: number): Promise<void> => ipcRenderer.invoke('folders:delete', id)
  },
  tags: {
    list: (): Promise<string[]> => ipcRenderer.invoke('tags:list')
  },
  chat: {
    send: (
      message: string,
      conversationId: number,
      taskContext?: Task | null
    ): Promise<void> => ipcRenderer.invoke('chat:send', message, conversationId, taskContext),
    history: (conversationId: number): Promise<Message[]> =>
      ipcRenderer.invoke('chat:history', conversationId),
    newConversation: (): Promise<Conversation> => ipcRenderer.invoke('chat:newConversation'),
    onChunk: (callback: (chunk: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, chunk: string): void => callback(chunk)
      ipcRenderer.on('chat:chunk', handler)
      return () => ipcRenderer.off('chat:chunk', handler)
    },
    onToolCall: (callback: (tool: { name: string; result: unknown }) => void) => {
      const handler = (
        _: Electron.IpcRendererEvent,
        tool: { name: string; result: unknown }
      ): void => callback(tool)
      ipcRenderer.on('chat:toolCall', handler)
      return () => ipcRenderer.off('chat:toolCall', handler)
    },
    onDone: (callback: () => void) => {
      const handler = (): void => callback()
      ipcRenderer.once('chat:done', handler)
      return () => ipcRenderer.off('chat:done', handler)
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, error: string): void => callback(error)
      ipcRenderer.once('chat:error', handler)
      return () => ipcRenderer.off('chat:error', handler)
    }
  },
  settings: {
    get: (key: string): Promise<string | null> => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('settings:set', key, value)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
