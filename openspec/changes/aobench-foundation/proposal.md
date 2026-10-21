# Proposal

## Why

There is no way for AI coding agents to interact with or be evaluated on Argentum Online. RuneBench demonstrated that MMORPGs are excellent environments for benchmarking LLM agents. Building on ao-libre (the original open-source AO server/client, AGPL) gives aobench a clean, dependency-free foundation: standard Winsock networking, a fully documented binary protocol, an existing `ApiConnection.bas` HTTP integration pattern, and no proprietary runtime requirements. AO20's unique Spanish-language MMORPG context — skills like Magia, Herrería, Pesca; factions, guilds, commerce — is covered by no existing benchmark.

## What Changes

- New public project `aobench` (monorepo at `recox/aobench`)
- Fork of `ao-libre/ao-server` with a new `BotAPI.bas` module that opens a TCP JSON listener on port 4200, allowing external callers to control characters and query world state without speaking the binary game protocol
- Fork of `ao-libre/ao-cliente` as the reference client (used to understand protocol and for manual testing)
- New `@aobench/sdk` TypeScript package — the only interface agents write against
- New `aobench-harness` CLI — manages benchmark runs: provision character, inject wiki docs + SDK, run LLM agent code, measure XP rate
- New `aobench-leaderboard` website (Nuxt 4) at `aobench.argentumonline.org` with public model rankings
- New `wiki-extractor` script producing markdown docs from ao-libre DAT and map files

## Capabilities

### New Capabilities

- `bot-server`: Fork of ao-libre/ao-server configured for bot-only use — anticheat off, XP multiplier, no email validation, isolated from production
- `bot-control-api`: `BotAPI.bas` VB6 module in the ao-libre server fork — TCP JSON listener on port 4200, accepts bot commands (`walk`, `attack`, `castSpell`, `useItem`, `work`, `talk`, etc.) and executes them by calling into existing protocol handlers; responds with acknowledgements and state
- `world-state`: Structured JSON snapshot of live character state (position, HP, mana, stamina, gold, exp, skills, inventory, nearby NPCs, nearby players, status effects) served by `BotAPI.bas` in response to a `getState` command
- `ao-sdk`: TypeScript package wrapping the BotAPI TCP JSON interface into a clean agent-facing API with full type definitions
- `wiki-extractor`: Script reading ao-libre DAT files (items, NPCs, spells, maps) and producing structured markdown context docs for agents
- `benchmark-harness`: Run lifecycle — provision character, inject context, sandbox agent TypeScript, measure XP rate per 15s window, define and run tasks, submit results
- `leaderboard`: Public website and API storing run results and showing model rankings
- `observer-mode`: A second client connection that attaches to a running bot character and mirrors all server→client packets to a VB6 client in real time, so a human can watch the AI play — movement, combat, spells, chat, HP — without interfering with the bot
- `gateway`: A Bun WebSocket process that sits between `BotAPI.bas` and the SDK, routing state snapshots and actions, managing control/observe session modes, and exposing HTTP endpoints (`GET /state/:bot`, `GET /chat/:bot`, `POST /say/:bot`) so tools can query bots without a persistent WebSocket
- `mcp-server`: A Model Context Protocol server in `packages/mcp` that exposes bot control and state as MCP tools, letting AI assistants (Claude, Cursor, Kiro) control bots directly without the harness CLI
- `bot-cli`: Three developer-facing CLI commands — `create-bot` (scaffolds a bot directory with credentials and script template), `cli` (dumps current WorldState as human-readable text for debugging), and `bug-report` (one-command report submission from inside a bot script)
- `lab-log`: A `lab_log.md` file per bot run that the LLM agent can read and write, enabling persistent notes and observations across script iterations within a run
- `multi-agent`: *(v2)* Multi-bot benchmark tasks where two or more characters interact — forming parties, trading items, coordinating combat, or competing as enemies. The gateway and SDK already support multiple simultaneous bot sessions; this capability adds multi-bot task definitions, combined scoring, and party/trade/whisper SDK methods.

### Modified Capabilities

- None — new project

## Impact

- New repo `recox/aobench`: monorepo — sdk, harness, leaderboard, wiki-extractor, gateway, mcp-server, bot-cli packages
- Branch `ao-libre/ao-server:aobench` — adds `BotAPI.bas` + `LoginObserver` packet + `ObserverConnectionID` on `t_User` + packet mirroring
- Branch `ao-libre/ao-cliente:aobench` — adds render toggle (F1 key) + observer login screen + read-only rendering mode
- No changes to production AO20 server, staging, or any player-facing service
- New infrastructure: dedicated Windows VM running ao-libre server + gateway process
