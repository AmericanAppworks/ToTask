# ToTask

A personal to-do app with Claude AI built in. Manage tasks, research them with web search, and let Claude break complex work into subtasks — all without leaving the app.

## Getting started

1. Download and open ToTask
2. Click **Settings** (⚙️ in the bottom-left) and enter your [Anthropic API key](https://console.anthropic.com/settings/keys)
3. Start adding tasks — Claude is in the right panel whenever you need it

## Features

- **Inbox, folders, and tags** — organize tasks however you like
- **Claude chat** — ask Claude to create, update, research, or split tasks using natural language
- **Web search** — Claude can look things up autonomously and save findings to task notes
- **Outline view** — text-editor-style task tree with keyboard-driven indent/unindent, drag-to-reorder, and inline note editing
- **Daily log** — review everything you completed on any given day
- **Markdown notes** — full markdown in task notes with headings, links, lists, and code blocks

## Keyboard shortcuts (Outline view)

| Key | Action |
|-----|--------|
| `Enter` | Create task below |
| `Tab` | Indent (make child of task above) |
| `Shift+Tab` | Unindent |
| `Cmd+Enter` | Complete / uncomplete |
| `Shift+Enter` | Edit note |
| `Backspace` | Delete task (when title is empty) |
| `↑ / ↓` | Navigate tasks |
| `Escape` | Blur / stop editing |

## For power users: Claude Code CLI integration

If you use [Claude Code](https://claude.ai/code), you can give it direct access to your ToTask database so it can read and manage your tasks from any terminal session.

**One-time setup** (run from the project directory):

```sh
npm run setup-mcp
```

Or manually:

```sh
claude mcp add --transport http totask http://localhost:3737/mcp
```

**Requirements:** ToTask must be running for Claude Code to connect. The MCP server starts automatically with the app on port 3737.

**Available tools** (usable from Claude Code once connected):

| Tool | Description |
|------|-------------|
| `list_tasks` | List tasks with optional filters (folder, tag, due date, completion, archived) |
| `get_task` | Get a task by ID |
| `create_task` | Create a task with title, folder, due date, notes, and tags |
| `update_task` | Update any field on a task |
| `complete_task` | Mark a task complete or incomplete |
| `archive_task` | Archive or unarchive a task |
| `archive_completed_tasks` | Archive all completed tasks |
| `delete_task` | Delete a task |
| `split_task` | Atomically create multiple subtasks under a parent |
| `list_folders` | List all folders |
| `create_folder` | Create a folder |
| `delete_folder` | Delete a folder |
| `list_tags` | List all tags in use |

**Example usage in Claude Code:**

```
> what tasks do i have due this week?
> create a task to review the Q3 report, due Friday, in the Work folder
> mark task 42 as complete
```

## Development

```sh
npm install
npm run dev          # start in development mode
npm run typecheck    # type-check without building
npm run build        # production build
npm run package:mac  # build macOS DMG
npm run package:win  # build Windows NSIS installer (requires Windows)
npm run reset        # clear all tasks and chat history (keeps API key)
npm run generate-icons  # regenerate app icons from resources/icon.svg
```

### Data location

- **macOS:** `~/Library/Application Support/ToTask/totask.db`
- **Windows:** `%APPDATA%\ToTask\totask.db`

## Tech stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-node) with web search and tool use
- [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [@dnd-kit](https://dndkit.com/) for drag-and-drop
