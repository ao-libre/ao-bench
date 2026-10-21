# Tasks

## 1. Repository Setup

- [x] 1.1 Create branch `aobench` on `ao-libre/ao-server`; verify the branch compiles in VB6 IDE and server.exe starts on the bot VM
- [x] 1.2 Create branch `aobench` on `ao-libre/ao-cliente`; verify it compiles and connects to the ao-libre server
- [x] 1.3 Create `recox/aobench` as a public GitHub repo with Bun workspace monorepo structure (`packages/sdk`, `packages/harness`, `packages/leaderboard`, `packages/wiki-extractor`, `packages/gateway`, `packages/mcp`); verify `bun install` succeeds
- [x] 1.4 Add shared `tsconfig.base.json`, ESLint flat config, and `.gitignore`; verify `bun run typecheck` and `bun run lint` pass with no errors

## 2. Bot Server Configuration

- [x] 2.1 Add `XpMultiplier` setting to `Config.ini` in the ao-libre fork; apply it to all XP awards in the server; verify a character gains N× XP when the multiplier is N
- [x] 2.2 Disable email validation for account creation in the ao-libre fork (skip the email send step); verify an account is immediately active without email confirmation
- [x] 2.3 Add `BOT_SERVER=1` compile flag that disables all anticheat checks in `AntiCheats/`; verify a bot client can connect and act at any packet rate without being kicked
- [x] 2.4 Configure the fork to store charfiles in a separate directory from any production data; verify characters created on the bot server do not appear elsewhere

## 3. VBJson Module

- [x] 3.1 Copy the `VBJson` module from `ao-libre/ao-cliente` (`CODIGO/VBJson/`) into the ao-libre server fork; add it to the VBP project file; verify the project compiles
- [x] 3.2 Write a VB6 test that parses a sample bot command JSON string and reads `action`, `charname`, and at least two parameters; verify it produces correct output

## 4. BotAPI.bas — Core Listener

- [x] 4.1 Create `frmBotAPI.frm` with a Winsock control array (`Socket(0..20)`); `Socket(0)` listens on port 4200; verify the form compiles and the port opens when the server starts
- [x] 4.2 Implement connection accept logic: on `Socket(0)_ConnectionRequest`, find a free slot and call `Socket(i).Accept`; verify multiple simultaneous TCP connections are accepted
- [x] 4.3 Implement message framing: buffer incoming data per socket, split on newline, dispatch complete JSON messages to `BotAPI.bas`; verify partial messages are buffered correctly
- [x] 4.4 Implement `charname → UserIndex` lookup in `BotAPI.bas` using a VB6 `Dictionary`; update it on bot login/logout; verify commands route to the correct `UserList` slot
- [x] 4.5 Implement `getState` command — serialize `UserList(i)` fields (pos, hp, mana, stamina, gold, exp, level, clase, heading, skills array, inventory array, nearbyNpcs, statusEffects) to JSON and send back; verify the response JSON is valid and matches live game state for a connected character

## 5. BotAPI.bas — Action Commands

- [x] 5.1 Implement `walk` command — parse heading string, call `MoverPersonaje` or equivalent ao-libre movement logic; verify the character moves one tile
- [x] 5.2 Implement `leftClick` command — call ao-libre left-click logic with the given tile offset; verify the correct NPC/tile is targeted
- [x] 5.3 Implement `attack` command — call ao-libre attack logic for the character's current target; verify combat is initiated
- [x] 5.4 Implement `castSpell` command — call ao-libre spell-cast logic for the given slot; verify the spell fires
- [x] 5.5 Implement `useItem` command — call ao-libre use-item logic for the given inventory slot; verify the item effect is applied
- [x] 5.6 Implement `work` command — map skill name string to `eSkill` enum value, call ao-libre work logic; verify the skill action triggers
- [x] 5.7 Implement `talk`, `yell`, and `whisper` commands — call ao-libre chat logic; verify messages appear in game
- [x] 5.8 Implement `pickUp` command — call ao-libre pickup logic for the given tile offset; verify item moves to inventory
- [x] 5.9 Implement `equipItem` command — call ao-libre equip logic for the given slot; verify item is equipped
- [x] 5.10 Implement `meditate` and `rest` commands — toggle the corresponding flags; verify character enters/exits meditation and rest
- [x] 5.11 Implement `drop` command — drop the given amount from the given inventory slot; verify item appears on ground
- [x] 5.12 Implement structured error responses for unknown action names and invalid parameters; verify malformed JSON and unknown actions return `{"ok":false,"error":"..."}` without crashing the server

## 6. Mock BotAPI Server

- [x] 6.1 Create `packages/mock-server` in the monorepo — a Node.js TCP server on port 4200 that accepts the same JSON protocol and returns simulated WorldState responses; verify it responds correctly to `getState`, `walk`, and `attack` commands
- [x] 6.2 Add a simulated NPC that can be targeted and attacked; add simulated XP gains on attack; verify the mock is sufficient to drive SDK and harness development without a running VB6 server

## 7. Gateway

- [x] 7.1 Scaffold `packages/gateway` as a Bun script with a WebSocket server on port 7780; verify it starts and accepts connections
- [x] 7.2 Implement outbound TCP JSON connection to BotAPI.bas port 4200 with reconnect on disconnect; verify gateway reconnects after server restart
- [x] 7.3 Implement per-bot state polling — send `getState` to BotAPI.bas every 600ms per connected bot, store latest WorldState; verify state is updated on each poll
- [x] 7.4 Implement `sdk_connect` message handling — register SDK sessions in control or observe mode, authenticate with password; verify control/observe session separation
- [x] 7.5 Implement last-controller-wins pre-emption — disconnect existing controller when a new control-mode SDK connects; verify old controller receives error and is closed
- [x] 7.6 Implement state fan-out deduplication — skip sending identical consecutive state frames to subscribers; verify with a timer-based test that duplicate frames are suppressed
- [x] 7.7 Implement `sdk_action` routing — forward actions from control SDK to BotAPI.bas, return results back; verify walk, attack, and useSkill actions round-trip correctly
- [x] 7.8 Implement `GET /state/:bot`, `GET /chat/:bot`, `POST /say/:bot` HTTP endpoints; verify each against a connected bot
- [x] 7.9 Implement `GET /status` endpoint showing all connected bots and SDK sessions; verify it lists active sessions
- [x] 7.10 Write integration tests for gateway session lifecycle (connect, state fanout, pre-emption, disconnect); verify `bun test` passes

## 8. ao-sdk Package (updated for gateway)

- [x] 8.1 Scaffold `packages/sdk` with `package.json` (name: `@aobench/sdk`), `src/index.ts`, and TypeScript types for `WorldState`, `NearbyNpc`, `InventorySlot`, `Skills` (20 ao-libre skills), `Heading` (N/S/E/W only); verify `bun run typecheck` passes
- [x] 8.2 Implement `AOBot` class connecting via WebSocket to the gateway (not direct TCP to BotAPI.bas); verify `connect()` succeeds and receives initial WorldState from gateway
- [x] 8.3 Implement `getState()` — returns latest WorldState from the gateway's cached state frame; verify typed response
- [x] 8.4 Implement `walk(heading)` with 4-direction support (north/south/east/west matching ao-libre `E_Heading`); implement `walkTo(x, y)` looping walk commands; verify both work
- [x] 8.5 Implement all action methods (`leftClick`, `attack`, `castSpell`, `useSkill`, `useItem`, `equipItem`, `pickUp`, `drop`, `meditate`, `rest`, `say`, `yell`, `whisper`); verify each sends the correct gateway action message
- [x] 8.6 Implement `waitTicks(n)` — waits `n × 600ms`; verify with timer test
- [x] 8.7 Implement `runScript(opts, fn)` — connects, runs fn, disconnects on completion or error; verify cleanup on throw
- [x] 8.8 Implement `appendLabLog(text)` — appends a timestamped entry to the bot's `lab_log.md`; verify the file is updated
- [x] 8.9 Implement `bugReport(description)` — POSTs to leaderboard API with state and action log; verify never throws
- [x] 8.10 Write unit tests against mock gateway; verify `bun test` passes with full method coverage
- [x] 8.11 Write `packages/sdk/README.md` with quickstart, full method reference, and WorldState type docs

## 9. Wiki Extractor (corrected for ao-libre)

- [x] 9.1 Scaffold `packages/wiki-extractor` CLI; verify `bun run wiki-extractor --help` prints usage
- [x] 9.2 Implement items DAT parser for ao-libre format; output `wiki/items.md`; verify it contains a known item
- [x] 9.3 Implement NPCs DAT parser; output `wiki/npcs.md`; verify stats for a known NPC
- [x] 9.4 Implement spells DAT parser; output `wiki/spells.md`; verify mana cost for a known spell
- [x] 9.5 Implement skills guide using the **20 ao-libre skills** (`eSkill` enum: Magia=1 through Navegación=20); compute XP thresholds; output `wiki/skills.md`
- [x] 9.6 Implement map zones guide; output `wiki/maps.md`
- [x] 9.7 Verify determinism: run twice, confirm `diff` shows no changes
- [x] 9.8 Write unit tests with ao-libre fixture files; verify `bun test` passes

## 10. Benchmark Harness

- [x] 10.1 Scaffold `packages/harness` CLI with `--model`, `--task`, `--server`, `--port` flags; verify `bun run harness --help`
- [x] 10.2 Implement character provisioning — create ao-libre account/charfile, log in, clean up; verify fresh character is in game and deleted after run
- [x] 10.3 Implement context injection — load wiki docs, SDK README, and `lab_log.md`; verify all three appear in agent context
- [x] 10.4 Implement Bun subprocess sandbox — allowlist `@aobench/sdk` imports and `appendLabLog` filesystem write only; verify `fs` import blocked, SDK import succeeds, `appendLabLog` succeeds
- [x] 10.5 Implement OpenAI LLM adapter; verify `--model gpt-4o` runs end-to-end
- [x] 10.6 Implement Anthropic LLM adapter; verify `--model claude-sonnet-4-5` runs end-to-end
- [x] 10.7 Implement XP rate measurement — poll getState every 2s, compute max XP delta in any 15s window; verify against scripted run
- [x] 10.8 Create `tasks/magia-xp.yaml`; verify harness applies time limit and starting position
- [x] 10.9 Implement leaderboard result submission; verify result appears after run
- [x] 10.10 Write integration test with scripted adapter and mock gateway; verify score and submission

## 11. MCP Server

- [x] 11.1 Scaffold `packages/mcp` as an MCP server using the MCP SDK; verify it starts and lists tools
- [x] 11.2 Implement `get_state(charname)` tool — calls `GET /state/:bot` on the gateway HTTP endpoint; verify it returns WorldState
- [x] 11.3 Implement `execute_action(charname, action)` tool — sends action via gateway WebSocket; verify walk and attack work
- [x] 11.4 Implement `execute_code(charname, code)` tool — runs TypeScript in the Bun sandbox, streams stdout; verify a simple state-reading script runs
- [x] 11.5 Implement `get_chat(charname, limit)` tool — calls `GET /chat/:bot` on gateway; verify chat history returned
- [x] 11.6 Implement `say(charname, message)` tool — calls `POST /say/:bot` on gateway; verify message appears in game
- [x] 11.7 Implement `search_wiki(query)` tool — full-text search across wiki markdown files; verify NPC lookup returns correct entry
- [x] 11.8 Write README for MCP server with installation and tool descriptions; verify it can be configured in Claude/Kiro

## 12. Bot CLI Tools

- [x] 12.1 Implement `create-bot [username]` in `packages/sdk/cli/create-bot.ts` — scaffolds `bots/<name>/bot.env` and `bots/<name>/script.ts`; verify both files are created with correct content
- [x] 12.2 Add `lab_log.md` to the `_template` directory with header and instructions; verify it is included in every `create-bot` scaffold
- [x] 12.3 Validate username: max 12 chars, alphanumeric only; verify long names and special chars are rejected
- [x] 12.4 Implement `bun sdk/cli.ts <charname>` — connects to gateway as observer, formats WorldState as human-readable text, prints and exits; verify output shows pos, HP, skills, and nearby NPCs
- [x] 12.5 Implement `--watch` flag for cli.ts — re-prints on each state update until Ctrl-C; verify updates appear on bot movement
- [x] 12.6 Implement `bot.bugReport(description)` in the SDK — POSTs to leaderboard `/api/bugs` with WorldState, SDK version, and action log; verify report is submitted and never throws

## 13. Leaderboard (updated)

- [x] 13.1 Scaffold `packages/leaderboard` as Nuxt 4 with Tailwind 4 + DaisyUI 5; verify `bun run dev` starts
- [x] 13.2 Create SQLite schema (`runs`, `bugs` tables); verify migration succeeds
- [x] 13.3 Implement `POST /api/runs` with API key auth; verify 201 on valid submission
- [x] 13.4 Implement `GET /api/leaderboard/:task` — best run per model; verify only top run per model returned
- [x] 13.5 Implement `GET /api/runs/:runId/log`; verify log matches submission
- [x] 13.6 Implement `POST /api/bugs` — stores bug reports from `bugReport()` calls; verify report stored with state and description
- [x] 13.7 Build leaderboard UI page with ranked table; verify renders with seed data
- [x] 13.8 Deploy to Railway at `aobench.argentumonline.org`; verify publicly accessible

## 14. Observer Mode

- [x] 14.1 Add `ObserverConnectionID` to `t_User` in ao-libre server fork; verify project compiles
- [x] 14.2 Implement `LoginObserver` handler in server — find charname UserIndex, store observer connection, replay current state; verify attachment works
- [x] 14.3 Mirror `SendData(ToUser, UserIndex, ...)` to observer connection; verify HP updates, moves, and chat reach observer
- [x] 14.4 Drop all action packets from observer except Talk; verify Walk/Attack from observer are silently discarded
- [x] 14.5 Clear observer on disconnect; verify bot continues running
- [x] 14.6 Reject second observer for same bot; verify second connection is closed with error
- [x] 14.7 Add observer login screen to ao-libre client fork; verify connects and receives packets
- [x] 14.8 Implement read-only rendering mode — disable input, show OBSERVE MODE indicator; verify no action packets sent
- [ ] 14.9 End-to-end: start bot run, connect observer, verify bot movement and combat visible live

## 15. End-to-End Validation

- [ ] 15.1 Run a full benchmark with scripted adapter; verify score computed and on leaderboard
- [ ] 15.2 Connect observer client during run; verify live gameplay visible
- [ ] 15.3 Run full benchmark with `--model gpt-4o`; verify agent acts and score recorded
- [ ] 15.4 Confirm bot server isolation — only bot accounts in charfile dir after runs

## Workflow follow-up

- Archive this change after all tasks are complete and 15.3 is validated.
- Create both GitHub repos (`recox/aobench` and `recox/ao-libre-server`) as public before starting task 1.1.

---

## v2 — Multi-Agent (not in scope for v1)

> The gateway and SDK already support multiple simultaneous bot sessions. These tasks become unblocked once v1 is complete.

- [ ] v2.1 Add `bots: N` field to task YAML; harness provisions N characters and passes N `AOBot` instances to the agent
- [ ] v2.2 Implement `bot.invite(charname)` and `bot.joinParty()` using `PartyCreate`/`PartyJoin` protocol
- [ ] v2.3 Implement `bot.offerTrade(charname)` using `UserCommerceOffer`/`UserCommerceOk` protocol
- [ ] v2.4 Implement combined multi-bot scoring (sum of XP deltas across all bots in 15s window)
- [ ] v2.5 Add Tab-switch between bots in observer mode
- [ ] v2.6 Design first multi-agent task (e.g. "party of 2 bots kills a boss faster than 1")
