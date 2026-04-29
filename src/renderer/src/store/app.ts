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
  viewMode: 'list' | 'outline'
  selectedTaskId: number | null
  openTabIds: number[]
  tabTitles: Record<number, string>
  chatTaskContext: Task | null
  showParentTasks: boolean
  isLoadingTasks: boolean

  init: () => Promise<void>
  loadFolders: () => Promise<void>
  loadTasks: () => Promise<void>
  selectView: (view: ViewSelection) => Promise<void>
  selectTask: (id: number | null) => void
  closeTab: (id: number) => void
  setTabTitle: (id: number, title: string) => void
  setChatContext: (task: Task | null) => void
  setViewMode: (mode: 'list' | 'outline') => void
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
  viewMode: 'list',
  selectedTaskId: null,
  openTabIds: [],
  tabTitles: {},
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
    if (view !== 'daily-log') await get().loadTasks()
  },

  selectTask: (id) => {
    set({ selectedTaskId: id })
    if (id !== null) {
      const { openTabIds, tasks } = get()
      if (!openTabIds.includes(id)) {
        set({ openTabIds: [...openTabIds, id] })
      }
      const task = tasks.find((t) => t.id === id)
      if (task) {
        set((s) => ({ chatTaskContext: task, tabTitles: { ...s.tabTitles, [id]: task.title } }))
      } else {
        window.api.tasks.get(id).then((t) => {
          set((s) => ({ chatTaskContext: t, tabTitles: { ...s.tabTitles, [id]: t.title } }))
        }).catch(() => {})
      }
    }
  },

  closeTab: (id) => {
    const { openTabIds, selectedTaskId } = get()
    const newTabs = openTabIds.filter((t) => t !== id)
    let newSelected = selectedTaskId
    if (selectedTaskId === id) {
      const idx = openTabIds.indexOf(id)
      newSelected = newTabs[idx - 1] ?? newTabs[0] ?? null
    }
    set({ openTabIds: newTabs, selectedTaskId: newSelected })
  },

  setTabTitle: (id, title) => {
    set((s) => ({ tabTitles: { ...s.tabTitles, [id]: title } }))
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setChatContext: (task) => set({ chatTaskContext: task }),

  setShowParentTasks: async (show) => {
    set({ showParentTasks: show })
    await window.api.settings.set('show_parent_tasks', String(show))
    await get().loadTasks()
  },

  createTask: async (input) => {
    const task = await window.api.tasks.create(input)
    await get().loadTasks()
    get().selectTask(task.id)
    return task
  },

  updateTask: async (id, input) => {
    const task = await window.api.tasks.update(id, input)
    await get().loadTasks()
    return task
  },

  deleteTask: async (id) => {
    await window.api.tasks.delete(id)
    get().closeTab(id)
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
