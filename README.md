# aobench

AI agent benchmark for Argentum Online (ao-libre).

LLM agents control bot characters in an isolated ao-libre server instance.
Performance is measured by XP gained per 15-second window across skill-specific tasks.

## Architecture

```
ao-libre server (VB6, Windows)
  └─ BotAPI.bas — TCP JSON listener on port 4200
       │
Bun gateway (port 7780)
  ├─ WebSocket — SDK clients
  └─ HTTP — GET /state/:bot, GET /chat/:bot, POST /say/:bot
       │
@aobench/sdk (TypeScript)
  └─ AOBot class — agent-facing API
```

## Packages

| Package | Description |
|---------|-------------|
| `packages/sdk` | `@aobench/sdk` — TypeScript SDK for agent scripts |
| `packages/gateway` | Bun WebSocket/HTTP gateway between VB6 and SDK |
| `packages/mock-server` | TCP mock of BotAPI.bas for local development |
| `packages/harness` | Benchmark CLI — provisions characters, runs agents, measures XP |
| `packages/leaderboard` | Nuxt 4 leaderboard website |
| `packages/wiki-extractor` | Generates wiki markdown from ao-libre DAT files |
| `packages/mcp` | MCP server exposing bot control as tools |

## Quick Start

```bash
bun install

# Start mock BotAPI server (no Windows VM needed)
bun run --filter mock-server start

# Start gateway (connects to mock-server or real BotAPI.bas)
bun run --filter gateway start

# Run SDK tests
bun run --filter @aobench/sdk test
```

## Docs

- [SDK README](packages/sdk/README.md)
- [Gateway README](packages/gateway/README.md)
- [Harness README](packages/harness/README.md)
- [openspec/changes/aobench-foundation/](openspec/changes/aobench-foundation/) — full design and task list
