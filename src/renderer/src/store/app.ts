import { create } from 'zustand'
import { format, addDays } from 'date-fns'
import type {
  Task,
  Folder,
  SmartList,
  TaskFilters,
  CreateTaskInput,
  UpdateTaskInput,
  SplitTaskInput
} from '@shared/types'

export type ViewSelection = SmartList | number

interface AppStore {
  folders: Folder[]
  tasks: Task[]
  selectedView: ViewSelection
  selectedTaskId: number | null
  chatTaskContext: Task | null
  showParentTasks: boolean
  isLoadingTasks: boolean

  init: () => Promise<void>
  loadFolders: () => Promise<void>
  loadTasks: () => Promise<void>
  selectView: (view: ViewSelection) => Promise<void>
  selectTask: (id: number | null) => void
  setChatContext: (task: Task | null) => void
  setShowParentTasks: (show: boolean) => Promise<void>

  createTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (id: number, input: UpdateTaskInput) => Promise<Task>
  deleteTask: (id: number) => Promise<void>
  completeTask: (id: number, completed: boolean) => Promise<Task>
  splitTask: (input: SplitTaskInput) => Promise<Task[]>

  createFolder: (name: string) => Promise<Folder>
  updateFolder: (id: number, name: string) => Promise<Folder>
  deleteFolder: (id: number) => Promise<void>
}

export const useAppStore = create<AppStore>((set, get) => ({
  folders: [],
  tasks: [],
  selectedView: 'inbox',
  selectedTaskId: null,
  chatTaskContext: null,
  showParentTasks: false,
  isLoadingTasks: false,

  init: async () => {
    const showParents = await window.api.settings.get('show_parent_tasks')
    set({ showParentTasks: showParents === 'true' })
    await Promise.all([get().loadFolders(), get().loadTasks()])
  },

  loadFolders: async () => {
    const folders = await window.api.folders.list()
    set({ folders })
  },

  loadTasks: async () => {
    const { selectedView, showParentTasks } = get()
    const today = format(new Date(), 'yyyy-MM-dd')

    let folderId: number | null | undefined = undefined
    const filters: TaskFilters = { showParents: showParentTasks }

    if (selectedView === 'inbox') {
      folderId = null
    } else if (selectedView === 'today') {
      filters.due_before = today
      filters.completed = false
    } else if (selectedView === 'upcoming') {
      filters.due_after = format(addDays(new Date(), 1), 'yyyy-MM-dd')
      filters.due_before = format(addDays(new Date(), 7), 'yyyy-MM-dd')
      filters.completed = false
    } else if (selectedView !== 'all') {
      folderId = selectedView as number
    }

    set({ isLoadingTasks: true })
    try {
      const tasks = await window.api.tasks.list(folderId, filters)
      set({ tasks, isLoadingTasks: false })
    } catch {
      set({ isLoadingTasks: false })
    }
  },

  selectView: async (view) => {
    set({ selectedView: view, selectedTaskId: null })
    await get().loadTasks()
  },

  selectTask: (id) => {
    set({ selectedTaskId: id })
    if (id) {
      const task = get().tasks.find((t) => t.id === id)
      if (task) {
        set({ chatTaskContext: task })
      } else {
        window.api.tasks.get(id).then((t) => set({ chatTaskContext: t })).catch(() => {})
      }
    }
  },

  setChatContext: (task) => set({ chatTaskContext: task }),

  setShowParentTasks: async (show) => {
    set({ showParentTasks: show })
    await window.api.settings.set('show_parent_tasks', String(show))
    await get().loadTasks()
  },

  createTask: async (input) => {
    const task = await window.api.tasks.create(input)
    await get().loadTasks()
    set({ selectedTaskId: task.id })
    return task
  },

  updateTask: async (id, input) => {
    const task = await window.api.tasks.update(id, input)
    await get().loadTasks()
    return task
  },

  deleteTask: async (id) => {
    await window.api.tasks.delete(id)
    if (get().selectedTaskId === id) set({ selectedTaskId: null })
    await get().loadTasks()
  },

  completeTask: async (id, completed) => {
    // Optimistic update for instant feedback
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed } : t))
    }))
    const task = await window.api.tasks.complete(id, completed)
    // Full reload to apply parent visibility rules
    await get().loadTasks()
    return task
  },

  splitTask: async (input) => {
    const subtasks = await window.api.tasks.split(input)
    await get().loadTasks()
    return subtasks
  },

  createFolder: async (name) => {
    const folder = await window.api.folders.create(name)
    await get().loadFolders()
    return folder
  },

  updateFolder: async (id, name) => {
    const folder = await window.api.folders.update(id, name)
    await get().loadFolders()
    return folder
  },

  deleteFolder: async (id) => {
    await window.api.folders.delete(id)
    if (get().selectedView === id) await get().selectView('inbox')
    await Promise.all([get().loadFolders(), get().loadTasks()])
  }
}))
