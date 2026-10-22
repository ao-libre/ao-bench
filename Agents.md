# Agents.md — aobench

> This file is the primary context document for AI agents working with or
> benchmarked on aobench. Read it in full before writing any code.

---

## What is aobench

aobench is a benchmark that measures how well LLM agents can play Argentum
Online — a Spanish-language MMORPG. Agents write TypeScript scripts that control
bot characters in an isolated game server. Performance is measured by the maximum
XP gained in any 15-second window during a timed task.

The game is **Argentum Online Libre** (ao-libre): an open-source VB6 server and
client running on Windows. Agents never interact with the VB6 binary protocol
directly — they use the `@aobench/sdk` TypeScript package, which connects to a
gateway process that translates commands into game actions.

The benchmark is inspired by [RuneBench](https://maxbittker.github.io/runebench/)
(OSRS). aobench is unique because:
- The game is in Spanish
- It has 20 distinct skills with different mechanics
- NPCs, items, and map descriptions are not in LLM training data
- The agent must read wiki docs, plan a strategy, and adapt in real time

---

## The game world

Argentum Online is a tile-based 2D MMORPG. Characters move on a grid
(north/south/east/west only — no diagonals). Each map is numbered; characters
spawn at a specific map, x, y coordinate.

### Classes (clase ID)

| ID | Class | Strengths |
|----|-------|-----------|
| 1 | Mago (Mage) | Magia, spells |
| 2 | Clérigo (Cleric) | Healing spells |
| 3 | Guerrero (Warrior) | Armas, Defensa, combat |
| 4 | Asesino (Assassin) | Apuñalar, Ocultarse |
| 5 | Ladrón (Thief) | Robar |
| 6 | Bardo (Bard) | Liderazgo |
| 7 | Druida (Druid) | Nature magic |
| 8 | Bandido (Bandit) | Combat |
| 9 | Paladín (Paladin) | Combat + healing |
| 10 | Cazador (Hunter) | Proyectiles |
| 11 | Trabajador (Worker) | All crafting skills |
| 12 | Pirata (Pirate) | Navegación |

Bot characters default to class 3 (Guerrero) unless the provisioner is
configured otherwise.

### Skills (20 total)

Each skill has a **level** (0–100) and **exp** within that level. Gaining exp
eventually increases the level. The benchmark measures XP rate — raw exp points
per time unit — not level increases.

| Skill | How to gain XP |
|-------|----------------|
| `Magia` | Cast spells (`castSpell`, `useSpellMacro`) |
| `Robar` | Use steal skill on players/NPCs |
| `Tacticas` | Win combat encounters |
| `Armas` | Attack NPCs or players |
| `Meditar` | Use `meditate()` while mana is not full |
| `Apuñalar` | Stab attacks (Assassin class) |
| `Ocultarse` | Use `useSkill("Ocultarse")` |
| `Supervivencia` | Take damage and survive |
| `Talar` | Use `workLeftClick(x,y)` on a tree tile |
| `Comerciar` | Buy/sell at NPC merchants |
| `Defensa` | Take hits in combat |
| `Pesca` | Use `useSkill("Pesca")` near water |
| `Minería` | Use `workLeftClick(x,y)` on a ore node |
| `Carpintería` | Use `craftCarpenter(itemId)` |
| `Herrería` | Use `craftBlacksmith(itemId)` |
| `Liderazgo` | Lead a party in combat |
| `Domar` | Tame creatures with `useSkill("Domar")` |
| `Proyectiles` | Attack with bows/arrows |
| `Wrestling` | Unarmed combat |
| `Navegación` | Navigate on boats |

### NPCs

Every NPC has a type, HP, attack, and defence. Hostile NPCs attack you
automatically when nearby. Killing NPCs gives XP to combat skills. NPC types:

| Type | Meaning |
|------|---------|
| 0 | Común (regular NPC, may be friendly or hostile) |
| 2 | Guardia (guard — attacks criminals) |
| 3 | Entrenador (trainer — use `train(npc, skill)`) |
| 4 | Banquero (banker — use `bankStart()`) |
| 5 | Noble / decorative |
| 6 | Dragón (dragon — very dangerous) |

Check `nearbyNpcs` in `WorldState` to find NPCs. A `hostile: true` field is not
in the state — infer hostility from whether their HP is decreasing.

### Maps

There are 317 maps. Map 1 is the main starting area (Banderbill). Benchmark tasks
specify a starting map, x, y. Key locations are described in `wiki/maps.md`.

---

## Your interface: @aobench/sdk

You **only import `@aobench/sdk`**. No other imports are allowed in sandbox mode.

```ts
import { AOBot } from "@aobench/sdk";
import type { WorldState, SkillName, Heading } from "@aobench/sdk";
```

### Connecting

```ts
const bot = new AOBot(process.env.CHARNAME ?? "MyBot", {
  gatewayUrl: process.env.GATEWAY_URL ?? "ws://localhost:7780",
  password:   process.env.BOT_PASSWORD ?? "aobench",
  mode:       "control",
});

await bot.connect();
const state = bot.getState();
```

Always use `process.env.CHARNAME` and `process.env.GATEWAY_URL` — these are
injected by the harness so the same script works in any environment.

### The WorldState

`bot.getState()` returns the latest snapshot (updated every 600ms by the
gateway). It never makes a network call — it returns the cached value.

```ts
const s = bot.getState();

s.charname        // "MyBot"
s.pos             // { x: 50, y: 50, map: 1 }
s.heading         // "north" | "south" | "east" | "west"
s.hp / s.maxHp    // current and max HP
s.mana / s.maxMana
s.stamina / s.maxStamina
s.gold            // gold carried
s.exp             // total XP (this is what the benchmark measures)
s.expNeeded       // XP required to reach next level (ELU)
s.level           // character level
s.clase           // class ID (see class table above)

s.skills          // { Magia: { level: 0, exp: 0 }, Armas: { level: 3, exp: 120 }, ... }
s.skillPts        // free skill points available to assign
s.assignedSkills  // how many of the initial 10 points have been assigned (must reach 10 before natural training works)

s.attributes      // { Fuerza: 18, Agilidad: 14, Inteligencia: 10, Carisma: 12, Constitucion: 16 }

s.inventory       // [ { slot: 1, itemId: 21, name: "Espada de Hierro", amount: 1, equipped: true }, ... ]
s.spells          // array of 35 slots: null or { slot, spellId, name, minSkill, manaCost }

s.bankGold        // gold in the bank
s.bank            // [ { slot, itemId, name, amount }, ... ] — bank inventory

s.nearbyNpcs      // [ { id: 1, name: "Goblin", x: 51, y: 50, hp: 80, maxHp: 80, type: 5 }, ... ]
s.nearbyPlayers   // [ { name: "OtherBot", x: 53, y: 50, hp: 100, maxHp: 100 }, ... ]
s.statusEffects   // ["poisoned", "paralyzed", ...] — active debuffs

s.faction         // "none" | "real" | "caos"
s.reputation      // { npcKills, playerKills, citizensKilled, criminalsKilled }

s.party           // null or { index, isLeader, members: ["Bot1", "Bot2"] }

s.quests          // { active: [...], doneIds: [1, 3, 5] }
                  // active item: { slot, questId, name, requiredLevel,
                  //   npcProgress: [{ npcId, required, killed }],
                  //   rewardXp, rewardGold }

s.timestamp       // server timestamp in ms
```

### Timing

The game runs at **one tick every 600ms**. `waitTicks(n)` waits `n * 600ms`.
Actions are processed server-side — if you send actions faster than one per tick,
they queue. For most strategies, wait at least 1 tick between actions.

```ts
await bot.attack();
await bot.waitTicks(1);  // wait for attack animation and response
await bot.attack();
```

### Movement

```ts
await bot.walk("north");       // move one tile
await bot.walkTo(60, 40);      // walk to coordinates (handles direction)
await bot.changeHeading("east"); // face east without moving
```

`walkTo` calls `walk` in a loop, preferring x-axis movement. Max 200 iterations.
After `walkTo`, check `getState().pos` to confirm arrival — walls and obstacles
may block movement.

### Combat

```ts
// The gateway auto-targets the nearest NPC if none is set
await bot.attack();

// Left-click a tile to target a specific NPC
await bot.leftClick(51, 50);  // target NPC at (51, 50)
await bot.attack();

// Cast a spell (hotbar slot 1)
await bot.castSpell(1);

// Double-click to interact (NPC dialogue, doors)
await bot.doubleClick(53, 50);
```

Check `nearbyNpcs` before attacking — if the list is empty, walk toward known
NPC spawn areas first.

### Skills and work

```ts
// Generic skill use (Ocultarse, Pesca, etc.)
await bot.useSkill("Talar");

// Skill on a specific tile (required for Talar, Minería)
await bot.workLeftClick(TREE_X, TREE_Y);

// Crafting
await bot.craftBlacksmith(ITEM_ID);  // must be at a forge
await bot.craftCarpenter(ITEM_ID);   // must be at a bench

// Meditation (regenerates mana while standing still)
await bot.meditate();
await bot.waitTicks(10);
await bot.meditate(); // toggle off
```

### Commerce and bank

```ts
// NPC shop — target merchant first
await bot.leftClick(MERCHANT_X, MERCHANT_Y);
await bot.waitTicks(1);
await bot.commerceStart();
await bot.commerceBuy(1, 5);   // buy 5 of item in shop slot 1
await bot.commerceSell(2, 10); // sell 10 of item in inventory slot 2
await bot.commerceEnd();

// Bank — must be next to banker NPC
await bot.bankStart();
await bot.bankDepositGold(500);
await bot.bankDeposit(3, 10);      // deposit 10 of inventory slot 3
await bot.bankExtractItem(1, 5);   // withdraw 5 of bank slot 1
await bot.bankEnd();
```

### Party

```ts
await bot.partyCreate();
await bot.partyMessage("Ready to fight!");
// Other bots join with: await bot2.partyJoin("MyBot");
await bot.partyAccept("Bot2");        // accept Bot2's join request
await bot.partyKick("Bot2");          // kick member
await bot.partySetLeader("Bot2");     // transfer leadership
await bot.partyLeave();               // leave (distributes pooled XP)
```

### Quests

```ts
// Walk to the quest NPC, then interact:
await bot.walkTo(QUEST_NPC_X, QUEST_NPC_Y);
await bot.quest(QUEST_NPC_X, QUEST_NPC_Y);  // shows quest details
await bot.questAccept();                     // accept the offered quest

// Check progress in getState():
const q = bot.getState().quests.active[0];
console.log(q.name, q.npcProgress);   // [{ npcId, required, killed }]

// Kill the required NPCs, then return and interact again to finish:
await bot.walkTo(QUEST_NPC_X, QUEST_NPC_Y);
await bot.quest(QUEST_NPC_X, QUEST_NPC_Y);  // finishes quest, grants XP

// Other quest actions:
await bot.questAbandon(1);            // abandon quest in slot 1
await bot.questListRequest();         // refresh active/done quest list
await bot.questDetailsRequest(1);     // get details for slot 1
```

Check `getState().quests.doneIds` to avoid retrying completed quests.

### Skill points

```ts
// Must assign all 10 initial points before natural training works.
// Check: getState().assignedSkills < 10 → call assignSkillPoints first.
const s = bot.getState();
if (s.assignedSkills < 10) {
  await bot.assignSkillPoints({ Armas: 4, Defensa: 3, Tacticas: 3 });
}
```

### Faction

```ts
await bot.enlist();       // join army (Royal Army or Chaos Legion depending on alignment)
await bot.leaveFaction(); // resign from current army
// Check current faction: getState().faction → "none" | "real" | "caos"
```

### Pets

```ts
await bot.petStand();    // order pet to stay
await bot.petFollow();   // order pet to follow
await bot.releasePet();  // free the pet
```

### Player-to-player trade

```ts
await bot.userCommerceCreate("OtherBot");  // initiate trade
await bot.userCommerceOffer(3, 5, 0);      // offer 5 of inv slot 3, 0 gold
await bot.userCommerceOk();                // confirm trade
// or: await bot.userCommerceReject();     // reject
await bot.userCommerceEnd();               // close trade window
```

### Combat challenges (duels)

```ts
await bot.fightSend("OtherBot", 100); // challenge with 100 gold wager
await bot.fightAccept();              // accept incoming challenge
```

### Friends

```ts
await bot.addAmigo("OtherBot");   // add to friends list
await bot.delAmigo("OtherBot");   // remove
await bot.msgAmigos("Hey all!");  // message all online friends
```

### Crafting (artisan)

```ts
// Walk to artisan NPC, double-click to open their window, then:
await bot.doubleClick(ARTISAN_X, ARTISAN_Y);
await bot.initCrafting();
await bot.craftsmanCreate(RECIPE_ITEM_ID);
```

### Lab log

The harness injects `lab_log.md` into the agent context at the start of each run.
Write observations here — they persist across script iterations and inform your
next attempt.

```ts
await bot.appendLabLog("Map 1 pos 50,50: Goblins spawn at (51,50). Attack gives Armas XP.");
await bot.appendLabLog("Magia slot 1 costs 12 mana. Need 80+ mana to cast 6 times.");
```

### Bug reports

If something unexpected happens, file a bug report. This never throws.

```ts
await bot.bugReport("NPC disappeared mid-combat — no kill XP awarded");
```

---

## Benchmark tasks

A task YAML defines the scenario:

```yaml
name: magia-xp
description: Gain as much XP as possible by casting Magia spells in 5 minutes
timeLimitSeconds: 300
startMap: 1
startX: 50
startY: 50
skill: Magia
```

The harness injects the task description into your context. Your goal is always
the same: **maximise XP gained in any 15-second window** during the run.

### Scoring

```
score = max(XP at time T+15s  −  XP at time T)  for all T in [0, runDuration]
```

A burst of 500 XP in 15 seconds scores higher than 1000 XP spread over 5 minutes.
Find the fastest repeatable action loop for the given skill.

---

## Strategy guide

### General approach

1. **Read the wiki docs** injected in your context (`wiki/skills.md`,
   `wiki/npcs.md`, `wiki/items.md`). They contain the only reliable information
   about ao-libre mechanics.

2. **Read your `lab_log.md`**. Previous runs may have mapped NPC locations,
   identified effective spell slots, or documented obstacles.

3. **Identify the fastest XP loop** for the target skill:
   - Combat skills (Armas, Defensa, Tacticas): find a nearby hostile NPC,
     attack in a loop, walk back if dead.
   - Magic (Magia): cast offensive spells at NPCs, watch mana. Meditate to
     restore. Each spell cast gives Magia XP.
   - Gathering (Talar, Minería, Pesca): walk to a resource tile, use
     `workLeftClick`, wait, repeat. Check inventory to avoid overflow.
   - Crafting (Herrería, Carpintería): requires materials in inventory. Buy
     them first if needed.

4. **Handle death**: if `hp <= 0` or `statusEffects` contains `"dead"`,
   walk to a Sacerdote NPC (type 1) and call `resucitate()`.

5. **Keep mana up**: use `meditate()` when mana < 20% of max. Toggle off when
   full. Meditation is interrupted by movement or combat.

6. **Write to lab_log** after each discovery so future runs improve on this one.

### Magia XP loop example

```ts
while (true) {
  const s = bot.getState();

  // Meditate if low mana
  if (s.mana < s.maxMana * 0.25) {
    await bot.meditate();
    while (bot.getState().mana < s.maxMana * 0.8) {
      await bot.waitTicks(2);
    }
    await bot.meditate(); // toggle off
    continue;
  }

  // Target nearest NPC if none
  if (s.nearbyNpcs.length === 0) {
    await bot.walk("east");
    await bot.waitTicks(1);
    continue;
  }

  const npc = s.nearbyNpcs[0];
  await bot.leftClick(npc.x, npc.y); // target it
  await bot.castSpell(1);             // cast Magia spell in slot 1
  await bot.waitTicks(2);             // wait for cast + cooldown
  console.log(`XP: ${bot.getState().exp}`);  // harness reads these lines
}
```

### Armas XP loop example

```ts
while (true) {
  const s = bot.getState();

  if (s.hp < s.maxHp * 0.2) {
    await bot.rest();
    await bot.waitTicks(8);
    await bot.rest();
    continue;
  }

  if (s.nearbyNpcs.length === 0) {
    await bot.walk("north");
    await bot.waitTicks(1);
    continue;
  }

  await bot.attack();
  await bot.waitTicks(1);
  console.log(`XP: ${bot.getState().exp}`);
}
```

---

## GM bot strategy

A GM bot has special privileges and can manipulate the world. This is useful
for benchmark setup tasks: populating a map with NPCs, creating items, warping
characters to optimal positions.

```ts
// Spawn 5 Goblins near the starting position
for (let i = 0; i < 5; i++) {
  await bot.gmSpawn(7);         // NPC ID 7 = Goblin (verify in wiki/npcs.md)
  await bot.waitTicks(1);
}

// Create items in the bot's inventory
await bot.gmCreateItem(51, 20); // 20 Pociones de Vida

// Warp a bot character to the optimal farming position
await bot.gmWarpChar("OtherBot", 1, 55, 48);

// Check character state
await bot.gmRequestCharInfo("OtherBot");
```

GM bots do not earn XP themselves — they are support characters.

---

## Observer mode

An observe-mode connection receives all state updates but cannot send actions
(except `say`). Use it to monitor a running bot without interfering.

```ts
const observer = new AOBot("MyBot", {
  gatewayUrl: "ws://localhost:7780",
  mode: "observe",
});
await observer.connect();

setInterval(() => {
  const s = observer.getState();
  console.log(`pos=${s.pos.x},${s.pos.y}  hp=${s.hp}/${s.maxHp}  exp=${s.exp}`);
}, 600);
```

---

## Context files injected by the harness

When the harness runs your script, it injects these into the LLM prompt:

| File | Content |
|------|---------|
| `wiki/skills.md` | All 20 skills with descriptions and how to gain XP |
| `wiki/items.md` | Item database (500 items — name, type, value, damage) |
| `wiki/npcs.md` | NPC database (306 NPCs — name, type, HP, damage, defence) |
| `wiki/spells.md` | Spell database (45 spells — name, mana cost, min skill, effect) |
| `wiki/maps.md` | Map zones guide |
| `packages/sdk/README.md` | Full SDK method reference (this document, condensed) |
| `bots/<name>/lab_log.md` | Your persistent notes from previous runs |
| Task description | `name`, `description`, `timeLimitSeconds`, `skill`, `startX/Y/Map` |

The harness truncates wiki docs and the SDK README to fit within the context
window. Prioritise reading the skill-specific section and the NPC list for the
task's target area.

---

## What the harness measures

The harness polls `getState()` every 2 seconds throughout the run. It records
all XP readings and computes:

```
score = max XP delta in any 15-second sliding window
```

It also parses lines matching `XP: <number>` from your script's stdout. Log XP
frequently so the harness has fine-grained data:

```ts
console.log(`XP: ${bot.getState().exp}`);  // do this inside your main loop
```

---

## Constraints

- **Only `@aobench/sdk` imports are allowed.** The sandbox rejects scripts that
  import `fs`, `node:*`, `child_process`, or any npm package other than
  `@aobench/sdk`.
- **`appendLabLog` is the only filesystem write allowed.** It writes to
  `./lab_log.md` in the bot directory. All other file operations are blocked.
- **The run ends after `timeLimitSeconds`.** The subprocess is killed; any work
  in progress is discarded. Structure your loop to emit XP logs continuously,
  not just at the end.
- **One bot per run by default.** Multi-agent tasks (v2) are not yet implemented.
- **The gateway password is `aobench`** unless `BOT_PASSWORD` env var is set.

---

## Complete bot script template

```ts
import { AOBot } from "@aobench/sdk";

const bot = new AOBot(process.env.CHARNAME ?? "MyBot", {
  gatewayUrl: process.env.GATEWAY_URL ?? "ws://localhost:7780",
  password:   process.env.BOT_PASSWORD ?? "aobench",
  mode:       "control",
});

await bot.runScript({}, async (b) => {
  const initial = b.getState();
  await b.appendLabLog(
    `Run started. Class: ${initial.clase}  ` +
    `Pos: (${initial.pos.x},${initial.pos.y}) map ${initial.pos.map}  ` +
    `Skills: Magia L${initial.skills["Magia"].level}  Armas L${initial.skills["Armas"].level}`
  );

  // ── Your strategy here ──────────────────────────────────────────────────

  let prevExp = initial.exp;

  for (let tick = 0; tick < 500; tick++) {
    const s = b.getState();

    // Handle death
    if (s.statusEffects.includes("dead")) {
      await b.appendLabLog("Died — walking to resurrect");
      // Walk to known Sacerdote NPC location, then resucitate()
      continue;
    }

    // Core XP loop — replace with task-specific logic
    if (s.nearbyNpcs.length > 0) {
      await b.attack();
    } else {
      await b.walk("north");
    }

    await b.waitTicks(1);

    const xp = b.getState().exp;
    const gained = xp - prevExp;
    prevExp = xp;
    if (gained > 0) {
      console.log(`XP: ${xp}`);  // harness reads this
    }
  }

  await b.appendLabLog(`Run ended. Final XP: ${b.getState().exp}`);
});
```

---

## Leaderboard

Results are posted to `https://aobench.argentumonline.org/api/leaderboard/<task>`.

Each entry shows:
- `model` — the LLM that generated the script
- `best_rate` — highest XP in any 15-second window (the score)
- `best_xp` — total XP in the best run
- `runs` — how many times this model has run the task

Only the best run per model appears. Improve your score by running again.

---

## Debugging tips

**State not updating?**
The gateway polls every 600ms. If `getState()` returns the same timestamp
repeatedly, the gateway may have lost its connection to the VB6 server.
File a bug report: `await bot.bugReport("State timestamp frozen")`.

**Walk not working?**
The character may be blocked by a wall or NPC. Try a different direction, or use
`changeHeading` to check facing. After `walkTo`, verify `getState().pos` matches
the target.

**No XP gain?**
- For combat: check `nearbyNpcs` is non-empty. NPCs respawn after ~3 seconds.
- For Magia: check `mana >= spell cost`. Meditate first.
- For Talar/Minería: `workLeftClick` requires a valid resource tile at `(x,y)`.
  Find tree/ore positions in `wiki/maps.md`.
- For crafting: verify you have the required materials in inventory.

**Combat stalling?**
After `attack()`, wait at least 1 tick before attacking again. The server
enforces a minimum interval between attacks (the anticheat bypass only removes
the kick, not the cooldown logic itself).

**Mana draining too fast?**
Spells cost varying amounts (see `wiki/spells.md`). Slot 1 may be an expensive
spell. Check `spellSlot` in the cast result and compare with `wiki/spells.md`.
Switch to a cheaper spell or meditate more frequently.

---

## Quick reference card

```
─── State ───────────────────────────────────────────────────────────────────
getState()                          → WorldState (cached, no network)
  .pos .hp .mana .stamina .gold .exp .expNeeded .level .clase
  .skills .skillPts .assignedSkills .attributes
  .inventory .spells .bank .bankGold
  .nearbyNpcs .nearbyPlayers .statusEffects
  .faction .reputation .party .quests .timestamp

─── Movement ────────────────────────────────────────────────────────────────
walk("north"|"south"|"east"|"west") → move one tile
walkTo(x, y)                        → walk to coordinates (loop, max 200 steps)
changeHeading("north"|...)          → face direction without moving

─── Combat ──────────────────────────────────────────────────────────────────
attack()                            → attack current/nearest NPC
leftClick(x, y)                     → target NPC/player at tile
castSpell(slot)                     → cast hotbar spell (slot 1–35)
useSpellMacro()                     → cast currently selected spell macro
doubleClick(x, y)                   → interact with NPC/door/object at tile

─── Skills & work ───────────────────────────────────────────────────────────
useSkill("Ocultarse"|"pesca"|...)   → use skill (see skills.md for exact names)
workLeftClick(x, y)                 → use work skill on specific tile (Talar, Mineria)
assignSkillPoints({ Armas:4, ... }) → spend free skill points (must do first!)
train(npcIndex, "Armas")            → train skill at a trainer NPC

─── Items ───────────────────────────────────────────────────────────────────
useItem(slot)                       → use item in inventory slot
equipItem(slot)                     → equip item in inventory slot
pickUp(x, y)                        → pick up item on the ground
drop(slot, amount)                  → drop item from inventory
moveItem(from, to)                  → rearrange inventory slots

─── Character state ─────────────────────────────────────────────────────────
meditate()                          → toggle mana regen (stand still, no movement)
rest()                              → toggle HP regen
resucitate()                        → resurrect at Sacerdote NPC (must be dead)
heal()                              → heal at Sacerdote NPC
home()                              → teleport to home city

─── Commerce (NPC shop) ─────────────────────────────────────────────────────
commerceStart()                     → open NPC shop (target merchant with leftClick first)
commerceBuy(slot, amount)           → buy from NPC shop slot
commerceSell(slot, amount)          → sell from inventory slot
commerceEnd()                       → close NPC shop
commerceChat(msg)                   → chat during commerce

─── Commerce (player trade) ─────────────────────────────────────────────────
userCommerceCreate("OtherBot")      → initiate trade with player
userCommerceOffer(slot, amount, gold) → offer item + gold
userCommerceOk()                    → confirm trade
userCommerceReject()                → reject trade
userCommerceConfirm()               → final confirmation
userCommerceEnd()                   → close trade window

─── Bank ────────────────────────────────────────────────────────────────────
bankStart()                         → open bank (target banker NPC first)
bankDeposit(slot, amount)           → deposit item from inventory
bankExtractItem(slot, amount)       → withdraw item from bank
bankDepositGold(amount)             → deposit gold
bankExtractGold(amount)             → withdraw gold
bankEnd()                           → close bank
moveBank(slot, fromBank?)           → move item between inv and bank

─── Crafting ────────────────────────────────────────────────────────────────
craftBlacksmith(itemId)             → craft at forge
craftCarpenter(itemId)              → craft at carpenter bench
initCrafting()                      → open artisan menu (doubleClick artisan first)
craftsmanCreate(itemId)             → craft via artisan
itemUpgrade(slot)                   → upgrade item at upgrade NPC

─── Spells ──────────────────────────────────────────────────────────────────
dragSpell(from, to)                 → move spell between hotbar slots
moveSpell(from, to)                 → move spell (alternative)

─── Quests ──────────────────────────────────────────────────────────────────
quest(x, y)                         → interact with quest NPC (first=offer, second=finish)
questAccept()                       → accept the offered quest
questAbandon(slot)                  → abandon active quest by slot
questListRequest()                  → refresh getState().quests
questDetailsRequest(slot)           → get details for slot

─── Party ───────────────────────────────────────────────────────────────────
partyCreate()                       → create party (you become leader)
partyJoin("leaderName")             → request to join a party
partyAccept("memberName")           → accept join request (leader only)
partyLeave()                        → leave party (distributes pooled XP)
partyKick("memberName")             → kick member (leader only)
partySetLeader("memberName")        → transfer leadership
partyMessage("text")                → message all party members
partyOnline()                       → list party members + XP

─── Faction ─────────────────────────────────────────────────────────────────
enlist()                            → join army (real or caos based on alignment)
leaveFaction()                      → leave current army faction

─── Pets ────────────────────────────────────────────────────────────────────
petStand()                          → order pet to stay
petFollow()                         → order pet to follow
releasePet()                        → free the pet

─── Duels ───────────────────────────────────────────────────────────────────
fightSend("target", gold?)          → challenge player to duel
fightAccept()                       → accept incoming duel

─── Chat & social ───────────────────────────────────────────────────────────
say(msg)                            → public chat in area
yell(msg)                           → area-wide chat
whisper("target", msg)              → private message
guildMessage(msg)                   → guild chat
addAmigo("name")                    → add friend
delAmigo("name")                    → remove friend
msgAmigos(msg)                      → message all online friends
online()                            → request online player count
lookProcess("name")                 → look up player info

─── Misc ────────────────────────────────────────────────────────────────────
changeDescription("text")           → set character description
forumPost(title, body, type?)        → post to in-game forum (0=general,1=real,2=caos)
guildFundate("name")                 → start guild founding
guildFundation()                     → complete guild founding

─── Utilities ───────────────────────────────────────────────────────────────
waitTicks(n)                        → wait n × 600ms
appendLabLog(text)                  → write persistent note to lab_log.md
bugReport(desc)                     → file a bug (never throws)
console.log("XP: " + s.exp)        → log XP for harness measurement

─── GM only (require GM privileges) ─────────────────────────────────────────
gmSpawn(npcId)  gmKillNpc(n)  gmKillAllNearby()
gmCreateItem(id, amount?)  gmDestroyItems()
gmGoToChar("name")  gmWarpChar("name",map,x,y)  gmWarpMe()  gmSummon("name")
gmRevive("name")  gmKick("name")  gmBan("name","reason")  gmSilence("name")
gmJail("name")  gmInvisible()  gmMessage(msg)  gmServerMessage(msg)  gmRain()
gmTeleportCreate(map,x,y,dMap,dX,dY)  gmEditChar("name",field,value)
gmSetDesc("name","desc")  gmCreateNpc(id)  gmMakeDumb("name")
gmMakeDumbNoMore("name")  gmRequestCharInfo("name")
```
