# ToTask — App Plan

## Overview

A native-feeling desktop to-do app built with Electron, React, and TypeScript. Tasks live in a local SQLite database. A Claude-powered chat panel lets you manage tasks with natural language. The app also exposes its own MCP server so any external MCP-capable client (Claude Desktop, Claude Code, etc.) can read and write your tasks.

---

## Layout

Three-column split pane, all visible at once:

```
┌─────────────┬──────────────────────────┬───────────────────┐
│  Sidebar    │      Task Detail          │   Claude Chat     │
│             │                           │                   │
│  Inbox      │  Title ________________  │  You: add a task  │
│  Work       │  Due   [date picker]      │  to do dishes     │
│  Personal   │  Tags  [tag input]        │  before Friday    │
│  ─────────  │  Notes [text area]        │                   │
│  + Folder   │                           │  ✓ Created task   │
│             │  [ Save ]  [ Delete ]     │  "Do the dishes"  │
│  ─────────  │                           │  due Friday       │
│  All Tasks  │  ─────────────────────   │                   │
│  Today      │  Task list (folder view)  │  [____________]   │
│  Upcoming   │  ☐ Task 1  due Mon        │  [  Send  ]       │
│             │  ☑ Task 2  (done)         │                   │
└─────────────┴──────────────────────────┴───────────────────┘
```

- Left pane: folder list + smart lists (Inbox, Today, Upcoming, All)
- Center pane: task list for selected folder + task detail editor below (or side-by-side on wider windows)
- Right pane: Claude chat with persistent conversation history
- All pane widths are drag-resizable

---

## Tech Stack

| Layer | Choice |
|---|---|
| App shell | Electron (latest stable) |
| Bundler | electron-vite (Vite inside Electron) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui components |
| Layout | react-resizable-panels |
| Database | better-sqlite3 (synchronous, no async complexity) |
| Migrations | Custom lightweight migration runner |
| Claude API | @anthropic-ai/sdk |
| MCP Server | @modelcontextprotocol/sdk |
| Date handling | date-fns |
| Packaging | electron-builder |

---

## Project Structure

```
totask/
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
│
├── src/
│   ├── main/                        # Electron main process
│   │   ├── index.ts                 # App entry, window creation
│   │   ├── db/
│   │   │   ├── database.ts          # DB connection singleton
│   │   │   ├── migrations.ts        # Schema migration runner
│   │   │   └── schema.sql           # Table definitions
│   │   ├── ipc/
│   │   │   ├── tasks.ts             # IPC handlers: CRUD for tasks
│   │   │   ├── folders.ts           # IPC handlers: CRUD for folders
│   │   │   ├── tags.ts              # IPC handlers: tag queries
│   │   │   └── chat.ts              # IPC handler: Claude API calls
│   │   ├── mcp/
│   │   │   ├── server.ts            # MCP server setup + tool registration
│   │   │   └── tools.ts             # Tool implementations (shared with ipc/)
│   │   └── claude/
│   │       ├── client.ts            # Anthropic SDK wrapper
│   │       └── tools.ts             # Claude tool definitions (mirrors MCP tools)
│   │
│   ├── preload/
│   │   └── index.ts                 # contextBridge exposing ipc to renderer
│   │
│   └── renderer/                    # React app
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AppShell.tsx     # Three-column resizable shell
│       │   │   ├── Sidebar.tsx      # Folder list + smart lists
│       │   │   └── StatusBar.tsx
│       │   ├── tasks/
│       │   │   ├── TaskList.tsx        # Scrollable task list; hides parent tasks w/ incomplete subtasks by default
│       │   │   ├── TaskRow.tsx         # Single task row (checkbox, title, due, tags, subtask count badge)
│       │   │   ├── TaskDetail.tsx      # Detail/edit form; shows ParentBreadcrumb and SubtaskList sections
│       │   │   ├── SubtaskList.tsx     # Inline list of child tasks within a task detail view
│       │   │   ├── ParentBreadcrumb.tsx # "↑ Build a shed" link shown when task has a parent
│       │   │   └── TagInput.tsx        # Inline tag chip input
│       │   ├── folders/
│       │   │   ├── FolderItem.tsx
│       │   │   └── NewFolderModal.tsx
│       │   └── chat/
│       │       ├── ChatPanel.tsx       # Full chat UI
│       │       ├── MessageList.tsx     # Scrollable message history
│       │       ├── MessageBubble.tsx
│       │       ├── ToolCallBubble.tsx  # Shows Claude's tool actions inline
│       │       ├── TaskContextChip.tsx # "📎 Build a shed ✕" chip shown above input when task is selected
│       │       └── ChatInput.tsx       # Textarea + send button; receives selected task as context prop
│       ├── hooks/
│       │   ├── useTasks.ts
│       │   ├── useFolders.ts
│       │   └── useChat.ts
│       ├── store/
│       │   └── app.ts               # Zustand global state
│       └── lib/
│           └── ipc.ts               # Typed wrappers around window.api
```

---

## Database Schema

```sql
CREATE TABLE folders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  folder_id    INTEGER REFERENCES folders(id) ON DELETE SET NULL,
  parent_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  notes        TEXT,
  due_date     TEXT,          -- ISO date string, e.g. "2026-04-25"
  completed    INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);
-- Recursive subtask queries use SQLite's WITH RECURSIVE CTE
-- e.g. to get all descendants of a task

CREATE TABLE task_tags (
  task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  PRIMARY KEY (task_id, tag)
);

CREATE TABLE conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,   -- 'user' | 'assistant' | 'tool'
  content         TEXT NOT NULL,   -- JSON for tool messages, plain text otherwise
  tool_use_id     TEXT,            -- set when role = 'tool'
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Stores: anthropic_api_key, active_conversation_id, mcp_port, show_parent_tasks (bool, default false)
```

---

## MCP Server

The app starts an HTTP/SSE MCP server on a configurable local port (default `3737`). This lets Claude Desktop, Claude Code, or any other MCP client connect and manage tasks.

**Server config** (for Claude Desktop's `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "totask": {
      "url": "http://localhost:3737/sse"
    }
  }
}
```

**Exposed MCP tools:**

| Tool | Description | Parameters |
|---|---|---|
| `list_tasks` | List tasks, optionally filtered | `folder_id?`, `tag?`, `completed?`, `due_before?`, `parent_id?` |
| `get_task` | Get a single task by ID (includes subtask count) | `id` |
| `create_task` | Create a new task | `title`, `folder_id?`, `due_date?`, `notes?`, `tags?`, `parent_id?` |
| `split_task` | Split a task into subtasks in one call | `parent_id`, `subtasks: [{title, due_date?, notes?}]` |
| `update_task` | Update any fields on a task | `id`, `title?`, `due_date?`, `notes?`, `tags?`, `folder_id?` |
| `complete_task` | Mark a task complete/incomplete | `id`, `completed` |
| `delete_task` | Delete a task permanently (cascades to subtasks) | `id` |
| `list_folders` | List all folders | — |
| `create_folder` | Create a new folder | `name` |
| `delete_folder` | Delete a folder (tasks become unfoldered) | `id` |
| `list_tags` | List all tags in use | — |

`split_task` is a convenience wrapper — it calls `create_task` for each subtask with the given `parent_id`. Prefer it over multiple `create_task` calls when splitting so all subtasks are created atomically in a single transaction.

---

## Claude Chat (In-App)

The chat panel calls the Claude API (claude-sonnet-4-6) directly from the main process. The same tool set exposed via MCP is passed as `tools` in every API call. Conversation history for the current session is accumulated and sent with each message (stateless API, stateful client).

**Task context:** The currently selected task in the center pane is automatically attached as context to the chat. The chat input shows a dismissable chip — `📎 Build a shed ✕` — and the task's full data (id, title, notes, due date, tags, subtask count) is injected into the user message sent to Claude. This lets the user say "can you make this easier?" without repeating themselves. The chip can be dismissed to send a context-free message.

**System prompt:**
```
You are a task management assistant integrated into ToTask, a personal to-do app.
You have tools to create, read, update, complete, delete, and split tasks and folders.
When the user describes something they need to do, create a task for it.
Infer reasonable due dates from natural language (e.g. "before Friday", "next week").
When the user refers to a task they want broken down or made easier, use split_task to
create subtasks under the referenced parent task. Subtasks should be concrete, actionable
steps. Confirm actions concisely after completing them. Ask for clarification only when
truly ambiguous. Today's date is always injected dynamically.
```

**Tool call UX:** When Claude invokes a tool, the chat panel shows a compact `ToolCallBubble` inline — e.g. `⚙ split_task "Build a shed" → 3 subtasks` — so the user can see what happened without it being noisy.

**API key:** Stored in the `settings` table. A first-run setup screen prompts for it if missing; also accessible from a Settings panel. Never logged or sent anywhere except `api.anthropic.com`.

---

## IPC Channels (Main ↔ Renderer)

```
tasks:list       (folderId?, filters) → Task[]   -- filters.showParents controls parent visibility
tasks:get        (id)                 → Task     -- includes subtask_count, parent task summary
tasks:create     (fields)             → Task     -- fields includes optional parent_id
tasks:update     (id, fields)         → Task
tasks:delete     (id)                 → void     -- cascades to subtasks
tasks:complete   (id, completed)      → Task
tasks:subtasks   (parentId)           → Task[]   -- direct children only; use recursive flag for full tree
tasks:split      (parentId, subtasks) → Task[]   -- atomic: creates all subtasks in one transaction

folders:list     ()                   → Folder[]
folders:create   (name)               → Folder
folders:update   (id, name)           → Folder
folders:delete   (id)                 → void

tags:list        ()                   → string[]

chat:send        (message, convId)    → AsyncIterable<ChatEvent>
chat:history     (convId)             → Message[]
chat:newConv     ()                   → Conversation

settings:get     (key)                → string
settings:set     (key, value)         → void
```

---

## Implementation Phases

### Phase 1 — Skeleton + Data Layer
- [ ] Init electron-vite project with React + TypeScript
- [ ] Configure Tailwind + shadcn/ui
- [ ] Set up better-sqlite3 + migration runner + schema
- [ ] Implement all IPC CRUD handlers
- [ ] Wire preload bridge

### Phase 2 — Core Task UI
- [ ] AppShell with resizable three-column layout
- [ ] Sidebar: folder list, smart lists (Inbox, Today, Upcoming)
- [ ] TaskList + TaskRow (checkbox, title, due badge, tags, subtask count badge)
- [ ] TaskDetail editor (title, due date picker, notes, tag input)
- [ ] ParentBreadcrumb in TaskDetail (shown when task has a parent)
- [ ] SubtaskList in TaskDetail (shows direct children, each row is a full TaskRow)
- [ ] Parent task visibility toggle: hide parents with incomplete subtasks by default; toggle in view menu
- [ ] Folder CRUD (create, rename, delete from sidebar)
- [ ] System theme support (dark/light via Tailwind)

### Phase 3 — Claude Chat
- [ ] Settings screen for API key entry
- [ ] ChatPanel, MessageList, MessageBubble, ChatInput
- [ ] TaskContextChip: selected task auto-attaches as context; chip is dismissable
- [ ] Inject selected task data into user message payload sent to Claude
- [ ] Streaming Claude API calls from main process via IPC
- [ ] Tool execution loop (handle tool_use blocks, run tools, send tool_result)
- [ ] ToolCallBubble component for inline tool visibility (including split_task summary)
- [ ] Persist conversation history in SQLite

### Phase 4 — MCP Server
- [ ] Implement MCP HTTP/SSE server on configurable port
- [ ] Register all 10 tools pointing to shared DB functions
- [ ] Auto-start server with app, display port in status bar
- [ ] Document Claude Desktop connection config

### Phase 5 — Polish
- [ ] Keyboard shortcuts (N new task, / search, Cmd+Enter save)
- [ ] Due date color coding (overdue = red, today = amber, upcoming = default)
- [ ] Empty states for folders, search, chat
- [ ] electron-builder config for macOS .dmg packaging
- [ ] App icon

---

## Key Decisions

**Why better-sqlite3 over a full ORM?** The data model is simple, synchronous SQLite is fast enough for a local app, and avoids the complexity of Drizzle/Prisma in an Electron context.

**Why HTTP/SSE MCP instead of stdio?** An HTTP server persists independently of any particular parent process, so Claude Desktop and the app can coexist without stdio plumbing. The port is configurable in Settings in case `3737` conflicts.

**Shared tool implementations:** The same TypeScript functions in `main/mcp/tools.ts` are called both by the MCP server and by the Claude API tool execution loop. No duplication.

**Streaming chat:** The Claude API response is streamed from main process to renderer via IPC so the chat panel shows tokens as they arrive rather than waiting for the full response.

**Parent task visibility:** When a task has one or more incomplete subtasks, it is filtered out of the task list by default. The setting `show_parent_tasks` in the settings table controls this globally and is toggled from the view menu. The "Upcoming" and "Today" smart lists respect this filter too. Parent tasks with all subtasks complete reappear in the list normally.

**Subtask inheritance:** Subtasks inherit their parent's `folder_id` by default at creation time. If the parent task's folder changes later, subtasks are not retroactively moved — this keeps the data simple and avoids surprising behavior.

**`split_task` atomicity:** The tool wraps all child `INSERT` statements in a single SQLite transaction, so either all subtasks are created or none are. This matters if Claude generates 5 subtasks and the process is interrupted partway through.

**Unlimited nesting:** The schema supports arbitrary depth via the recursive `parent_id` FK. The UI renders up to 2 levels inline (parent → children) in the detail view; deeper trees are navigated by clicking into a subtask and seeing its own children. The `WITH RECURSIVE` CTE is used for queries that need the full descendant set (e.g. "are all descendants complete?").
