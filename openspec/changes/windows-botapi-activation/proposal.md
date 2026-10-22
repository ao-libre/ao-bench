# Proposal

## Why

The Linux-side work on 2026-10-22 added 35 new BotAPI actions, 10 new
`getState` fields, redesigned 7 quests with realistic kill counts, and assigned
quest givers to existing city NPCs (128/137/143 on map 1). All of this is
committed on the `aobench` branch of `ao-libre/ao-server` but none of it is
live — the Windows VM still runs the old compiled `server.exe`. Until the VB6
server is recompiled and restarted, agents cannot use quests, cannot assign
skill points, and cannot see faction/spells/bank/party in `getState`. The
gateway and SDK packages also need to be updated on Windows to pick up the new
TypeScript types and the 157 updated tests.

## What Changes

- Recompile `server.exe` on Windows VM (192.168.22.51) from the `aobench` branch
- Restart the ao-libre server so the new `BotAPI.bas` and DAT files are live
- Pull and reinstall `ao-bench` packages on Windows so the gateway and SDK
  reflect the new `WorldState` type (11 new required fields) and all 80 SDK methods
- Smoke test the new quest flow, `assignSkillPoints`, and `getState` completeness

## Capabilities

### Modified Capabilities

- `world-state`: 10 new fields now returned by `getState` — `expNeeded`,
  `skillPts`, `assignedSkills`, `attributes`, `spells` (35-slot hotbar),
  `bank`, `bankGold`, `faction`, `reputation`, `party`, `quests`
- `bot-control-api`: 35 new actions now handled by `BotAPI.bas` — `quest`,
  `questAccept`, `questAbandon`, `assignSkillPoints`, `partyAccept`, `partyKick`,
  `partySetLeader`, `leaveFaction`, `petStand`, `petFollow`, `releasePet`,
  `itemUpgrade`, `initCrafting`, `craftsmanCreate`, `fightSend`, `fightAccept`,
  `userCommerceCreate`, `userCommerceConfirm`, `commerceChat`, `moveBank`,
  `moveSpell`, `forumPost`, `addAmigo`, `delAmigo`, `onAmigos`, `msgAmigos`,
  `lookProcess`, `consultation`, `discord`, `online`, `guildFundate`,
  `guildFundation`, `partyOnline`, `requestPartyForm`
- `ao-sdk`: `WorldState` type now includes all 11 new fields; 35 new methods
  added to `AOBot`; `forumPost` param renamed `type→forumType` to avoid
  WebSocket field collision; 157 tests all passing

### New Capabilities

- Quest system usable by bots: `quest(x,y)` → `questAccept()` → kill NPCs →
  `quest(x,y)` to hand in. 24 quests available, 7 redesigned with kill counts
  of 3–20 (was 100–2000). Quests 22/23/24 now accept from city NPCs 128/137/143.
- Skill point assignment gate: agents must call `assignSkillPoints()` before
  natural XP accumulates. Now visible and actionable via `getState().skillPts`
  and `getState().assignedSkills`.

## Impact

- `ao-libre/ao-server:aobench` — `Codigo/BotAPI.bas`, `Dat/NPCs.dat`,
  `Dat/Quests.DAT` already committed; only the Windows build + restart is needed
- `ao-libre/ao-bench:main` — `packages/sdk/src/types.ts`, `aobot.ts`,
  `aobot.test.ts`, `packages/mock-server/src/handlers.ts`, `state.ts`,
  `packages/gateway/src/index.test.ts` already committed; only `pnpm install`
  and gateway restart is needed
- No changes to production AO20 server, staging, or any player-facing service
