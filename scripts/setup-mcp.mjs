#!/usr/bin/env node
// Registers the ToTask MCP server with Claude Code so you can manage
// tasks directly from the Claude Code CLI while the app is running.

import { execSync } from 'child_process'

const SERVER_NAME = 'totask'
const SERVER_URL = 'http://localhost:3737/mcp'

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' })
  } catch {
    return null
  }
}

// Check claude CLI is available
if (!run('which claude')) {
  console.error('Claude Code CLI not found. Install it from https://claude.ai/code and try again.')
  process.exit(1)
}

// Remove old registration if present (handles both old SSE and new http transport)
run(`claude mcp remove ${SERVER_NAME} 2>/dev/null`)

// Register with streamable-http transport
try {
  execSync(`claude mcp add --transport http ${SERVER_NAME} ${SERVER_URL}`, { stdio: 'inherit' })
  console.log(`\nDone! "${SERVER_NAME}" MCP server registered.`)
  console.log(`Make sure the ToTask app is running before using it in Claude Code.\n`)
} catch {
  console.error('Failed to register MCP server. Is the Claude Code CLI installed and up to date?')
  process.exit(1)
}
