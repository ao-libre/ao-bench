# aobench

AI agent benchmark for Argentum Online (ao-libre).

LLM agents write TypeScript scripts that control bot characters in an isolated
ao-libre game server. Performance is measured by XP gained per 15-second window
across skill-specific tasks. The leaderboard at
[aobench.argentumonline.org](https://aobench.argentumonline.org) ranks models by
their best score.

Inspired by [RuneBench](https://github.com/lavague-ai/runebench) — same concept,
Spanish-language MMORPG context, different game mechanics.

---

## How it works

```
┌─────────────────────────────────────────────────────────────────┐
│                  WINDOWS VM (ao-libre server)                    │
│                                                                  │
│  port 7666  ◄─── binary game protocol ────  Argentum.exe        │
│             (human players, unchanged)       /bot auto-login     │
│                                                                  │
│  port 4200  ◄─── newline-delimited JSON ──── gateway only       │
│             BotAPI.bas (new, aobench branch)                     │
│             72 actions, same game logic                          │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ TCP JSON
┌──────────────────────────────────▼──────────────────────────────┐
│                  gateway  (port 7780)                            │
│                                                                  │
│  - Polls getState every 600ms per connected bot                  │
│  - Fans state out to SDK subscribers (deduped)                   │
│  - Routes SDK actions to BotAPI.bas                              │
│  - HTTP: GET /state/:bot  GET /chat/:bot  POST /say/:bot         │
└──────────┬──────────────────────────────────────────────────────┘
           │ WebSocket
┌──────────▼──────────────────────────────────────────────────────┐
│              @aobench/sdk  (TypeScript)                          │
│                                                                  │
│  const bot = new AOBot("MyBot", { gatewayUrl, password });       │
│  await bot.connect();                                            │
│  await bot.castSpell(1);   // Magia                              │
│  await bot.attack();                                             │
│  const state = bot.getState();  // WorldState                    │
└──────────┬──────────────────────────────────────────────────────┘
           │ import
┌──────────▼──────────────────────────────────────────────────────┐
│              harness CLI                                         │
│                                                                  │
│  1. Write .chr + .acc + .ach bot account files                   │
│  2. Inject wiki docs + SDK README + lab_log.md into context      │
│  3. Call LLM → generate bot script                               │
│  4. Run script in sandboxed subprocess (only @aobench/sdk)       │
│  5. Measure max XP in any 15-second window                       │
│  6. POST score to leaderboard                                     │
│  7. Clean up bot account files                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Scoring

The score for a run is the **maximum XP gained in any 15-second window** during
the run. A model that figures out the right skill rotation and targets beats one
that wanders — there is no time bonus for finishing early.

The leaderboard keeps only the **best run per model per task**.

---

## Repository layout

```
ao-libre/ao-bench          ← this repo (TypeScript monorepo)
ao-libre/ao-server:aobench ← ao-libre server fork (VB6, Windows)
ao-libre/ao-cliente:aobench← ao-libre client fork (VB6, Windows)
```

### Monorepo packages

| Package | Description |
|---------|-------------|
| `packages/sdk` | `@aobench/sdk` — TypeScript SDK agents import |
| `packages/gateway` | WebSocket + HTTP bridge between VB6 and SDK |
| `packages/mock-server` | TCP mock of BotAPI.bas — full Linux dev without Windows |
| `packages/harness` | Benchmark CLI — provisions accounts, runs agents, scores |
| `packages/wiki-extractor` | Parses ao-libre DAT files → markdown wiki docs |
| `packages/leaderboard` | HTTP leaderboard server + SQLite |
| `packages/mcp` | MCP server — lets Claude/Kiro/Cursor control bots directly |

---

## ao-bench monorepo internals

### Package dependency graph

```
packages/sdk          ← no internal deps (only Node.js built-ins)
    ▲
    │ import @aobench/sdk
    ├── packages/mock-server   (dev stub, imports sdk/types only)
    ├── packages/gateway       (imports sdk/types only)
    ├── packages/harness       (imports @aobench/sdk for provisioner + sandbox)
    └── packages/mcp           (imports @aobench/sdk)

packages/leaderboard  ← standalone (better-sqlite3, Node http)
packages/wiki-extractor ← standalone (Node fs only)
```

Only the harness, MCP, and mock-server import the SDK at runtime. The gateway
imports only the TypeScript *types* from the SDK — it never instantiates AOBot.

### How each package works

**`packages/sdk`** — The only package agents ever import.

```
src/
  types.ts      ← WorldState, Skills, Heading, all wire protocol types
  aobot.ts      ← AOBot class (75 methods)
  index.ts      ← re-exports everything
  cli/
    create-bot.ts   ← npx tsx create-bot.ts <name>
    bot-cli.ts      ← npx tsx bot-cli.ts <name> [--watch]
```

`AOBot` holds a single WebSocket to the gateway. All action methods call the
private `sendAction()` which pushes a `sdk_action` message and enqueues a
Promise resolve. When the gateway sends back a `result` message, the oldest
pending Promise resolves (FIFO — gateway guarantees ordered replies). State
arrives as `state` push messages; `getState()` returns the last one received.

**`packages/gateway`** — The translation layer. One process, four responsibilities:

```
src/
  index.ts          ← wires everything together, starts HTTP + WS servers
  botapi-client.ts  ← persistent TCP connection to VB6 port 4200, reconnects
  poller.ts         ← setInterval per bot: getState every 600ms
  session-manager.ts← state cache, control/observe sessions, fan-out, chat log
  ws-handler.ts     ← handles sdk_connect and sdk_action from WebSocket clients
  http-handler.ts   ← GET /state  GET /chat  POST /say  GET /status
```

The gateway maintains **one TCP connection** to VB6 shared across all bots.
Each bot gets its own 600ms polling timer. State fan-out skips identical
consecutive frames (JSON string comparison). Pre-emption: a new `control`
session closes the existing one immediately.

**`packages/mock-server`** — Drop-in replacement for the VB6 server during dev.

```
src/
  index.ts      ← net.createServer, newline framing, charname→state routing
  state.ts      ← BotState shape, makeDefaultState()
  handlers.ts   ← handleRequest(): all 72 actions simulated
```

Each connection gets its own `BotState` keyed by `charname`. Actions mutate
state directly (no concurrency issues — Node.js is single-threaded). The mock
is not a faithful physics simulation — it's just enough to drive SDK and harness
development without Windows.

**`packages/harness`** — The benchmark orchestrator.

```
src/
  cli.ts            ← argument parsing, calls runBenchmark()
  runner.ts         ← end-to-end orchestration (steps 1–7)
  provisioner.ts    ← writes .chr + .acc + .ach files
  context-builder.ts← assembles LLM prompt from wiki + README + lab_log
  llm-adapter.ts    ← OpenAI / Anthropic / scripted adapters
  sandbox.ts        ← spawns npx tsx subprocess, kills on timeout
  xp-meter.ts       ← sliding 15s window max XP measurement
  leaderboard-client.ts ← POST /api/runs
  task-loader.ts    ← loads tasks/magia-xp.yaml
  types.ts          ← HarnessConfig, TaskSpec, RunResult
tasks/
  magia-xp.yaml     ← first benchmark task definition
```

The sandbox security model is simple: before spawning, the harness checks the
generated code for `from 'fs'`, `from 'node:'`, `from 'child_process'` etc. and
rejects it. The subprocess gets `GATEWAY_URL` and `BOT_PASSWORD` in its
environment; it can only reach the gateway over WebSocket.

**`packages/wiki-extractor`** — Parses ao-libre DAT files into markdown.

```
src/
  cli.ts          ← argument parsing
  parser.ts       ← generic INI parser (handles latin1 encoding, CRLF)
  extractors.ts   ← extractItems / extractNpcs / extractSpells / extractSkills
```

DAT files are Windows INI format with ISO-8859-1 encoding. The parser reads
them as latin1, splits on `[SECTIONn]` headers, skips comment lines (`'`, `#`).
Output is deterministic — running twice produces identical files.

**`packages/leaderboard`** — Plain Node.js HTTP server + SQLite.

```
src/
  server.ts   ← http.createServer, route dispatch, inline HTML homepage
  api.ts      ← handlePostRun / handleGetLeaderboard / handleGetRunLog / handlePostBug
  db.ts       ← better-sqlite3, schema creation (runs + bugs tables)
```

No framework, no ORM. Accepts both camelCase (`xpRate`) and snake_case
(`xp_rate`) field names so the harness and manual curl both work. Uses
`INSERT OR REPLACE` so re-submitting the same `runId` is idempotent.

**`packages/mcp`** — MCP server over stdio.

```
src/
  index.ts    ← Server + StdioServerTransport, 7 tools
```

Tools call the gateway's HTTP endpoints (`/state`, `/chat`, `/say`, `/status`)
or open a WebSocket for `execute_action`. `execute_code` spawns `npx tsx` with
the GATEWAY_URL injected, streams stdout back to the caller.

### Configuration

All runtime config comes from environment variables — no config files needed:

| Variable | Default | Used by |
|----------|---------|---------|
| `BOTAPI_HOST` | `127.0.0.1` | gateway |
| `BOTAPI_PORT` | `4200` | gateway |
| `PORT` | `7780` | gateway |
| `BOT_PASSWORD` | `aobench` | gateway, sdk, mcp |
| `GATEWAY_URL` | `ws://localhost:7780` | sdk, harness |
| `PORT` | `3000` | leaderboard |
| `LEADERBOARD_API_KEY` | `aobench-key` | leaderboard |
| `LEADERBOARD_URL` | `` | harness |
| `OPENAI_API_KEY` | — | harness (gpt-* models) |
| `ANTHROPIC_API_KEY` | — | harness (claude-* models) |
| `WIKI_DIR` | `./wiki` | mcp |
| `DB_PATH` | `./leaderboard.db` | leaderboard |
| `CHARFILE_DIR` | `./Charfile` | harness provisioner |

### Testing

Each package has its own test suite. Run all:
```bash
npm run test        # 118 tests across 7 packages
```

Or per-package:
```bash
cd packages/sdk && npx vitest run
cd packages/mock-server && npx vitest run
cd packages/harness && npx vitest run
cd packages/leaderboard && npx vitest run
cd packages/gateway && npx vitest run
cd packages/wiki-extractor && npx vitest run
```

### Adding a new task

1. Create `packages/harness/tasks/<taskname>.yaml`:
```yaml
name: herreria-xp
description: Gain XP by smithing items at a blacksmith for 5 minutes
timeLimitSeconds: 300
startMap: 1
startX: 55
startY: 48
skill: Herrería
```

2. Run it:
```bash
npx tsx packages/harness/src/cli.ts --model gpt-4o --task herreria-xp
```

---

## Quick start (Linux / macOS — no Windows needed)

```bash
git clone https://github.com/ao-libre/ao-bench
cd ao-bench
npm install

# 1. Start the mock BotAPI server (simulates the VB6 server)
npx tsx packages/mock-server/src/index.ts &

# 2. Start the gateway
npx tsx packages/gateway/src/index.ts &

# 3. Run a scripted benchmark (no API key needed)
npx tsx packages/harness/src/cli.ts --model scripted --task magia-xp

# 4. Check results
curl http://localhost:3000/api/leaderboard/magia-xp
```

### With a real LLM

```bash
export OPENAI_API_KEY=sk-...
npx tsx packages/harness/src/cli.ts --model gpt-4o --task magia-xp

export ANTHROPIC_API_KEY=sk-ant-...
npx tsx packages/harness/src/cli.ts --model claude-sonnet-4-5 --task magia-xp
```

### Generate wiki docs from ao-libre DAT files

```bash
npx tsx packages/wiki-extractor/src/cli.ts \
  --dat-dir ../ao-server/Dat \
  --out-dir wiki/
# Outputs: wiki/items.md  wiki/npcs.md  wiki/spells.md  wiki/skills.md  wiki/maps.md
```

### Create a bot scaffold

```bash
npx tsx packages/sdk/src/cli/create-bot.ts MyBot
# Creates: bots/MyBot/bot.env  script.ts  lab_log.md
```

### Watch a bot live (observer mode)

```bash
npx tsx packages/sdk/src/cli/bot-cli.ts MyBot --watch
```

---

## VB6 server setup (Windows VM)

The ao-libre server and client run on Windows only. The `aobench` branch of both
repos adds bot-specific features on top of the unmodified ao-libre codebase.

### ao-libre/ao-server:aobench changes

| File | What it does |
|------|-------------|
| `Codigo/BotAPI.bas` | TCP JSON listener on port 4200. Dispatches all 72 actions by writing params into `incomingData` and calling the existing protocol handlers — no game logic is duplicated. |
| `Codigo/frmBotAPI.frm` | Winsock control array. `Socket(0)` listens; `Socket(1..20)` accept clients. Newline-delimited framing with per-socket buffers. |
| `Codigo/modNuevoTimer.bas` | All `IntervaloPermite*` functions return `True` when `BOT_SERVER=1` — bots can act at any speed without anticheat kicks. |
| `Codigo/modAntiCheat.bas` | `AddCount`/`CheckInt` are no-ops when `BOT_SERVER=1`. |
| `Codigo/Declares.bas` | `ObserverConnID As Long` added to `User` type — links a bot to a watching client. |
| `Codigo/modSendData.bas` | All packets sent to a user are mirrored to their observer socket. |
| `Codigo/BotAPITest.bas` | 8 VB6 unit tests for JSON parsing and dispatch. Run from debug build. |
| `ai_build_vb6.cmd` | Build script with `BOT_SERVER=1` flag. |
| `Server.ini` | `ExpMulti=20`, `OroMulti=20` — faster XP for meaningful benchmark windows. |

**Build:**
```cmd
ai_build_vb6.cmd
```
This compiles with `BOT_SERVER=1:UsarQueSocket=1:ConUpTime=1:AntiExternos=0`.

**Verify port 4200 is open after starting server.exe:**
```cmd
netstat -an | findstr 4200
echo {"action":"getState","charname":"test"} | nc localhost 4200
```

### ao-libre/ao-cliente:aobench changes

| File | What it does |
|------|-------------|
| `CODIGO/Declares.bas` | `BotAutoLogin`, `BotEmail`, `BotPassword_CL`, `BotCharName` globals. |
| `CODIGO/General.bas` | Parses `/bot email password charname` from `Command()` string. |
| `CODIGO/Formularios/frmConnect.frm` | `Form_Activate` auto-triggers login when `BotAutoLogin=True`. |
| `CODIGO/Red/Protocol.bas` | After account login response, auto-selects matching character by name. |
| `CODIGO/Formularios/frmObserver.frm` | New form — connects to BotAPI port 4200, sends `loginObserver`, displays state JSON in a listbox. |

**Launch a bot client headlessly:**
```cmd
Argentum.exe /bot bot@aobench.local mypassword MyBotChar
```
The client connects, authenticates, selects `MyBotChar`, and enters the game
with no user interaction.

---

## Account & character provisioning

ao-libre uses three files per character:

```
Account/ACCOUNTNAME.acc   ← account credentials (Password, Salt, Hash)
Account/<hash>.ach        ← account→character mapping (up to 10 chars)
Charfile/CHARNAME.chr     ← character data (stats, position, skills)
```

The harness `provisioner.ts` writes all three. Up to 10 bot characters can share
one account — useful for multi-agent runs:

```ts
import { provisionBot, deprovisionBot } from "@aobench/harness/provisioner";

// One dedicated account per bot (default)
const creds = provisionBot("Bot1", { charfileDir: "C:/ao-libre/Charfile" });

// Multiple bots sharing one account (multi-agent)
const config = { charfileDir, accountName: "BenchSession01" };
provisionBot("Bot1", config);
provisionBot("Bot2", config);  // up to 10
```

---

## The SDK

Agents import `@aobench/sdk` and use the `AOBot` class. 75 methods total.

```ts
import { AOBot } from "@aobench/sdk";

const bot = new AOBot("MyBot", {
  gatewayUrl: process.env.GATEWAY_URL ?? "ws://localhost:7780",
  password: process.env.BOT_PASSWORD ?? "aobench",
});

await bot.runScript({}, async (b) => {
  const state = b.getState();
  console.log(`XP: ${state.exp}  HP: ${state.hp}/${state.maxHp}`);

  for (let i = 0; i < 20; i++) {
    if (state.nearbyNpcs.length > 0) {
      await b.attack();
    } else {
      await b.walk("north");
    }
    await b.waitTicks(1);   // wait one game tick (600ms)
    console.log(`XP: ${b.getState().exp}`);
  }

  await b.appendLabLog("Attacked goblin 20 times, gained XP");
});
```

See [packages/sdk/README.md](packages/sdk/README.md) for the full method reference.

### WorldState

Every `getState()` call returns:

```ts
interface WorldState {
  charname: string;
  pos:      { x: number; y: number; map: number };
  heading:  "north" | "south" | "east" | "west";
  hp:       number;  maxHp:      number;
  mana:     number;  maxMana:    number;
  stamina:  number;  maxStamina: number;
  gold:     number;
  exp:      number;
  level:    number;
  clase:    number;
  skills:   Record<SkillName, { level: number; exp: number }>;
  inventory:    InventorySlot[];
  nearbyNpcs:   NearbyNpc[];
  nearbyPlayers: NearbyPlayer[];
  statusEffects: StatusEffect[];
  timestamp: number;
}
```

### ao-libre skills (all 20)

| # | Skill | # | Skill |
|---|-------|---|-------|
| 1 | Magia | 11 | Defensa |
| 2 | Robar | 12 | Pesca |
| 3 | Tacticas | 13 | Minería |
| 4 | Armas | 14 | Carpintería |
| 5 | Meditar | 15 | Herrería |
| 6 | Apuñalar | 16 | Liderazgo |
| 7 | Ocultarse | 17 | Domar |
| 8 | Supervivencia | 18 | Proyectiles |
| 9 | Talar | 19 | Wrestling |
| 10 | Comerciar | 20 | Navegación |

---

## BotAPI protocol reference

All messages are newline-delimited JSON over TCP (port 4200).

```
client → server:   {"action":"<name>","charname":"<name>"[,params]}\n
server → client:   {"ok":true[,result fields]}\n
                   {"ok":false,"error":"<message>"}\n
```

### getState

Returns the full `WorldState` for the named character.

```json
{"action":"getState","charname":"Bot1"}
{"ok":true,"state":{...WorldState...}}
```

### Player actions (32)

| Action | Required params | Description |
|--------|----------------|-------------|
| `walk` | `heading` | Move one tile (north/south/east/west) |
| `attack` | — | Attack current target (auto-targets nearest NPC) |
| `castSpell` | `slot` | Cast spell in macro slot 1–35 |
| `useItem` | `slot` | Use inventory item |
| `useSkill` / `work` | `skill` | Use skill (Talar, Minería, Pesca…) |
| `workLeftClick` | `x`, `y` | Use skill on specific tile (tree, ore node) |
| `leftClick` | `x`, `y` | Target NPC/player at tile |
| `doubleClick` | `x`, `y` | Open NPC dialogue / door |
| `changeHeading` | `heading` | Face direction without moving |
| `pickUp` | — | Pick up item at feet |
| `equipItem` | `slot` | Equip/unequip item |
| `drop` | `slot`, `amount` | Drop item |
| `moveItem` | `from`, `to` | Rearrange inventory slots |
| `meditate` | — | Toggle meditation |
| `rest` | — | Toggle rest |
| `say` | `message` | Public chat |
| `yell` | `message` | City-wide chat |
| `whisper` | `target`, `message` | Private message |
| `partyMessage` | `message` | Party chat |
| `guildMessage` | `message` | Guild chat |
| `useSpellMacro` | — | Cast spell macro slot 1 |
| `dragSpell` | `from`, `to` | Move spell between macro slots |
| `craftBlacksmith` | `item` | Craft at blacksmith |
| `craftCarpenter` | `item` | Craft at carpenter |
| `train` | `npc`, `skill` | Train skill at NPC |
| `commerceStart` / `commerceBuy` / `commerceSell` / `commerceEnd` | — / `slot,amount` / `slot,amount` / — | NPC commerce |
| `userCommerceOffer` / `userCommerceOk` / `userCommerceReject` / `userCommerceEnd` | `slot,amount,gold` / — / — / — | Player trade |
| `bankStart` / `bankDeposit` / `bankExtractItem` / `bankDepositGold` / `bankExtractGold` / `bankEnd` | various | Bank |
| `partyCreate` / `partyJoin` / `partyLeave` | — / `leader` / — | Party |
| `shareNpc` / `stopSharingNpc` | — | Share NPC target |
| `resucitate` / `heal` | — | NPC resurrection / healing |
| `home` | — | Teleport to home city |
| `enlist` | — | Join army faction |
| `changeDescription` | `desc` | Change character description |

### GM actions (25, require GM privileges)

| Action | Required params | Description |
|--------|----------------|-------------|
| `gmGoToChar` | `target` | Teleport self to target |
| `gmWarpChar` | `target`, `map`, `x`, `y` | Teleport target to location |
| `gmWarpMe` | — | Teleport self to current target |
| `gmSummon` | `target` | Summon target to self |
| `gmSpawn` | `npc` | Spawn NPC at current position |
| `gmKillNpc` | `npc` | Kill NPC by index |
| `gmKillAllNearby` | — | Kill all nearby NPCs |
| `gmCreateItem` | `item`, `amount?` | Create item in inventory |
| `gmDestroyItems` | — | Destroy ground items |
| `gmRevive` | `target` | Revive dead character |
| `gmKick` | `target` | Kick player |
| `gmBan` | `target`, `reason` | Ban player |
| `gmSilence` | `target` | Silence player |
| `gmJail` | `target` | Jail player |
| `gmInvisible` | — | Toggle GM invisibility |
| `gmMessage` | `message` | Broadcast to all players |
| `gmServerMessage` | `message` | Server-wide message |
| `gmRain` | — | Toggle rain |
| `gmTeleportCreate` | `map`,`x`,`y`,`destMap`,`destX`,`destY` | Create teleport tile |
| `gmEditChar` | `target`, `field`, `value` | Modify character stat |
| `gmSetDesc` | `target`, `desc` | Set character description |
| `gmCreateNpc` | `npc` | Create NPC |
| `gmMakeDumb` / `gmMakeDumbNoMore` | `target` | Block/unblock spell casting |
| `gmRequestCharInfo` | `target` | Get character details |

### Observer mode

A second connection can attach to a running bot and receive all packets the bot
receives — movement, combat, chat, HP — in real time.

```json
{"action":"loginObserver","charname":"Bot1"}
{"ok":true,"observing":"Bot1"}
```

After attaching, every packet sent to `Bot1` is mirrored to the observer socket.
Observer connections cannot send actions (except `say`). Launch the ao-libre
client with the observer form to watch visually.

---

## Gateway WebSocket protocol

Connect to `ws://localhost:7780`.

```json
// Connect as controller (one per bot at a time)
{"type":"sdk_connect","charname":"Bot1","password":"aobench","mode":"control"}
{"type":"connected","charname":"Bot1","mode":"control"}

// State is pushed every 600ms (deduplicated)
{"type":"state","state":{...WorldState...}}

// Send an action
{"type":"sdk_action","action":"walk","charname":"Bot1","heading":"north"}
{"type":"result","ok":true,"moved":true}

// Connect as observer (unlimited per bot)
{"type":"sdk_connect","charname":"Bot1","password":"aobench","mode":"observe"}
```

If a new controller connects while one is active, the old controller is
disconnected with `{"type":"error","code":"preempted"}`.

---

## Leaderboard API

Base URL: `http://localhost:3000` (dev) or `https://aobench.argentumonline.org`

| Endpoint | Description |
|----------|-------------|
| `POST /api/runs` | Submit a benchmark run result (requires `Authorization: Bearer <key>`) |
| `GET /api/leaderboard/:task` | Best run per model for a task, ranked by `xp_rate` |
| `GET /api/runs/:runId/log` | Full agent stdout log for a run |
| `POST /api/bugs` | Submit a bug report from `bot.bugReport()` |
| `GET /health` | `{"ok":true}` |
| `GET /` | HTML rankings page |

**Submit a run:**
```bash
curl -X POST https://aobench.argentumonline.org/api/runs \
  -H "Authorization: Bearer <key>" \
  -H "Content-Type: application/json" \
  -d '{
    "runId": "my-run-001",
    "model": "gpt-4o",
    "task": "magia-xp",
    "xpGained": 1200,
    "xpRate": 450,
    "durationMs": 300000,
    "success": true,
    "log": "XP: 450\nXP: 1200"
  }'
```

---

## MCP server

Lets Claude, Kiro, or Cursor control bots directly without the harness CLI.

Add to your MCP config:

```json
{
  "mcpServers": {
    "aobench": {
      "command": "npx",
      "args": ["tsx", "/path/to/ao-bench/packages/mcp/src/index.ts"],
      "env": {
        "GATEWAY_URL": "http://localhost:7780",
        "BOT_PASSWORD": "aobench",
        "WIKI_DIR": "/path/to/ao-bench/wiki"
      }
    }
  }
}
```

Tools: `get_state`, `execute_action`, `execute_code`, `get_chat`, `say`,
`search_wiki`, `list_bots`.

---

## Development

```bash
npm install           # install all workspace packages
npm run typecheck     # tsc --noEmit across all packages
npm run test          # vitest across all packages (118 tests)
npm run build         # tsc build across all packages
```

### Running against mock server (no Windows needed)

```bash
# Terminal 1
npx tsx packages/mock-server/src/index.ts

# Terminal 2
npx tsx packages/gateway/src/index.ts

# Terminal 3 — check state via HTTP
curl http://localhost:7780/status

# Terminal 3 — run a scripted benchmark
npx tsx packages/harness/src/cli.ts --model scripted --task magia-xp
```

### Running against the real VB6 server

1. On Windows VM: build with `ai_build_vb6.cmd`, start `server.exe`
2. Set `BOTAPI_HOST` env var to the Windows VM IP (default: `127.0.0.1`)
3. Start the gateway: `BOTAPI_HOST=192.168.x.x npx tsx packages/gateway/src/index.ts`
4. Launch bot client: `Argentum.exe /bot email pass CharName`
5. Run harness: `npx tsx packages/harness/src/cli.ts --model gpt-4o --task magia-xp`

---

## Design decisions

**Why a separate port for bots instead of reusing port 7666?**

Port 7666 speaks a binary protocol — raw bytes, custom encoding, ~150 packet
types. Implementing it in TypeScript would mean writing a full game client.
BotAPI.bas on port 4200 translates JSON into the binary protocol internally and
calls the same server-side handlers. TypeScript never sees the binary protocol.

**Why poll getState instead of pushing events?**

Push requires the server to emit structured JSON for every game event. Polling at
600ms (one game tick) is sufficient for agent decision-making — agents are not
latency-sensitive at the millisecond level. Can be upgraded to push in a future
change.

**Why fork ao-libre instead of AO20?**

ao-libre is AGPL, has no proprietary dependencies, and compiles cleanly with the
standard VB6 toolchain. AO20 requires licensed DLLs (CryptoSys, BASS), EAC, and
a production login server.

---

## Status

| Layer | Status |
|-------|--------|
| TypeScript monorepo (sdk, gateway, harness, wiki, leaderboard, mcp) | ✅ Complete — 118/118 tests |
| VB6 server fork (BotAPI.bas, anticheat bypass, observer mode) | ✅ Written — needs Windows compile |
| VB6 client fork (auto-login, observer form) | ✅ Written — needs Windows compile |
| First end-to-end run (scripted adapter) | ⏳ Pending Windows VM |
| First LLM run (gpt-4o / claude) | ⏳ Pending Windows VM |
| Railway deploy (aobench.argentumonline.org) | ⏳ Pending |

---

## Licence

AGPL-3.0-only — same as ao-libre.
