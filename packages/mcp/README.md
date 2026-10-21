# @aobench/mcp — MCP Server

Model Context Protocol server for aobench. Lets AI assistants (Claude, Kiro, Cursor) control bots directly.

## Installation

Add to your MCP config (e.g. `~/.kiro/agents/your-agent.json`):

```json
{
  "mcpServers": {
    "aobench": {
      "command": "npx",
      "args": ["tsx", "/path/to/ao-bench/packages/mcp/src/index.ts"],
      "env": {
        "GATEWAY_URL": "http://localhost:7780",
        "BOT_PASSWORD": "aobench"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `get_state` | Get current WorldState for a bot |
| `execute_action` | Execute a bot action (walk, attack, castSpell, etc.) |
| `get_chat` | Get recent chat log for a bot |
| `say` | Send a chat message |
| `search_wiki` | Search ao-libre wiki (items, NPCs, spells, skills) |
| `list_bots` | List all connected bots and sessions |
| `execute_code` | Run a TypeScript bot script in a sandboxed subprocess |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_URL` | `http://localhost:7780` | Gateway HTTP base URL |
| `BOT_PASSWORD` | `aobench` | Password for WebSocket bot sessions |
| `WIKI_DIR` | `./wiki` | Path to generated wiki `.md` files |

## Prerequisites

1. Start the mock server: `npx tsx packages/mock-server/src/index.ts`
2. Start the gateway: `npx tsx packages/gateway/src/index.ts`
3. Connect a bot (or use the harness to run one)

## Tool Reference

### `get_state`

Returns the full `WorldState` JSON for the named bot: position, HP/mana/stamina, inventory, nearby NPCs and players, skills, and status effects.

```json
{ "charname": "TestBot" }
```

### `execute_action`

Executes any BotAPI action over a WebSocket control session. Opens a connection, authenticates, dispatches the action, waits up to 10 s for the result, then closes.

```json
{ "charname": "TestBot", "action": "walk", "params": { "heading": "north" } }
```

### `get_chat`

Returns the last N chat entries for a bot (default 50).

```json
{ "charname": "TestBot", "limit": 20 }
```

### `say`

Posts a chat message through the gateway.

```json
{ "charname": "TestBot", "message": "Hello world!" }
```

### `search_wiki`

Searches all `.md` files in `WIKI_DIR` for lines containing the query (case-insensitive). Returns up to 20 matching lines prefixed with the source filename.

```json
{ "query": "espada" }
```

### `list_bots`

Returns the gateway `/status` object — all connected bots and their session metadata.

```json
{}
```

### `execute_code`

Runs a TypeScript script in a sandboxed `npx tsx` subprocess. The following constants are injected at the top of the script before execution:

```ts
const __CHARNAME__ = "<charname>";
const __GATEWAY_URL__ = process.env.GATEWAY_URL ?? 'ws://localhost:7780';
```

The subprocess also receives `GATEWAY_URL`, `BOT_PASSWORD`, and `CHARNAME` as environment variables.

Returns an object with `stdout`, `stderr`, `exitCode`, and `timedOut`.

```json
{
  "charname": "TestBot",
  "code": "import { BotClient } from '@aobench/sdk';\nconsole.log(__CHARNAME__);",
  "timeout_seconds": 30
}
```
