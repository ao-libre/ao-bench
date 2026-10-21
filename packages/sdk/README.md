# @aobench/sdk

TypeScript SDK for writing bots that connect to the **ao-bench** gateway and control or observe characters in Argentum Online Libre.

---

## Quickstart

```bash
npm install @aobench/sdk
```

```ts
import { AOBot } from "@aobench/sdk";

const bot = new AOBot("MiPersonaje", {
  gatewayUrl: "ws://localhost:7780",
  password: "aobench",
  mode: "control",
});

await bot.connect();
console.log("Connected! State:", bot.getState());

await bot.say("Hola mundo!");
await bot.waitTicks(2);

bot.disconnect();
```

---

## Constructor

```ts
new AOBot(charname: string, opts?: AOBotOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gatewayUrl` | `string` | `ws://localhost:7780` | Gateway WebSocket URL |
| `password` | `string` | `aobench` | Shared gateway password |
| `mode` | `'control' \| 'observe'` | `'control'` | Control executes actions; observe is read-only |

---

## Method Reference

### Connection

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `connect()` | — | `Promise<void>` | Opens WebSocket, authenticates, waits for `connected` message. Rejects on timeout (10s) or auth error. |
| `disconnect()` | — | `void` | Closes the WebSocket immediately. |
| `getState()` | — | `WorldState` | Returns the latest world state. Throws if not connected or no state received yet. |

### Movement

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `walk(heading)` | `heading: Heading` | `Promise<BotApiOkResponse>` | Move one tile in the given direction. |
| `walkTo(x, y)` | `x: number, y: number` | `Promise<void>` | Walk toward tile `(x, y)`, preferring x-axis movement. Max 200 steps. |

### Combat & Interaction

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `attack()` | — | `Promise<BotApiOkResponse>` | Attack the current target. |
| `castSpell(slot)` | `slot: number` | `Promise<BotApiOkResponse>` | Cast the spell in the given hotbar slot. |
| `useSkill(skill)` | `skill: SkillName` | `Promise<BotApiOkResponse>` | Use a skill by name (see Skills list below). |
| `leftClick(x, y)` | `x: number, y: number` | `Promise<BotApiOkResponse>` | Simulate a left click on tile `(x, y)`. |

### Inventory

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `useItem(slot)` | `slot: number` | `Promise<BotApiOkResponse>` | Use item in inventory slot (1-based). |
| `equipItem(slot)` | `slot: number` | `Promise<BotApiOkResponse>` | Equip item in inventory slot. |
| `pickUp(x, y)` | `x: number, y: number` | `Promise<BotApiOkResponse>` | Pick up item at tile `(x, y)`. |
| `drop(slot, amount)` | `slot: number, amount: number` | `Promise<BotApiOkResponse>` | Drop `amount` units from inventory slot. |

### Character States

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `meditate()` | — | `Promise<BotApiOkResponse>` | Toggle meditation (mana regeneration). |
| `rest()` | — | `Promise<BotApiOkResponse>` | Toggle resting (HP regeneration). |

### Chat

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `say(message)` | `message: string` | `Promise<BotApiOkResponse>` | Say something in local chat. |
| `yell(message)` | `message: string` | `Promise<BotApiOkResponse>` | Yell (visible across wider radius). |
| `whisper(target, message)` | `target: string, message: string` | `Promise<BotApiOkResponse>` | Send a private message to `target`. |

### Timing & Utilities

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| `waitTicks(n)` | `n: number` | `Promise<void>` | Wait `n` game ticks (1 tick = 600 ms). |
| `appendLabLog(text)` | `text: string` | `Promise<void>` | Append a timestamped line to `./lab_log.md`. Never throws. |
| `bugReport(description)` | `description: string` | `Promise<void>` | POST a bug report with current state to `http://localhost:3000/api/bugs`. Never throws. |

---

## WorldState

The `WorldState` object returned by `getState()` has these fields:

| Field | Type | Description |
|-------|------|-------------|
| `charname` | `string` | Character name |
| `pos` | `Position` | Current tile `{ x, y, map }` |
| `heading` | `Heading` | Facing direction: `north \| south \| east \| west` |
| `hp` | `number` | Current HP |
| `maxHp` | `number` | Maximum HP |
| `mana` | `number` | Current mana |
| `maxMana` | `number` | Maximum mana |
| `stamina` | `number` | Current stamina |
| `maxStamina` | `number` | Maximum stamina |
| `gold` | `number` | Gold carried |
| `exp` | `number` | Experience points |
| `level` | `number` | Character level |
| `clase` | `number` | Class ID (see ao-libre class table) |
| `skills` | `Skills` | Map of `SkillName → { level, exp }` |
| `inventory` | `InventorySlot[]` | Inventory slots (1-based, see below) |
| `nearbyNpcs` | `NearbyNpc[]` | NPCs visible on screen |
| `nearbyPlayers` | `NearbyPlayer[]` | Players visible on screen |
| `statusEffects` | `StatusEffect[]` | Active effects: `poisoned \| bleeding \| paralyzed \| frozen \| stunned` |
| `timestamp` | `number` | Server timestamp (ms) |

### InventorySlot

```ts
{ slot: number; itemId: number; name: string; amount: number; equipped: boolean }
```

### NearbyNpc

```ts
{ id: number; name: string; x: number; y: number; hp: number; maxHp: number; type: number }
```

---

## Skills (ao-libre — 20 total)

| Skill name | Description |
|------------|-------------|
| `Magia` | Magic / spell power |
| `Robar` | Stealing |
| `Tacticas` | Combat tactics |
| `Armas` | Weapon proficiency |
| `Meditar` | Meditation speed |
| `Apuñalar` | Stabbing / assassination |
| `Ocultarse` | Hiding / stealth |
| `Supervivencia` | Survival / HP regeneration |
| `Talar` | Woodcutting |
| `Comerciar` | Trading / merchant prices |
| `Defensa` | Defence / damage reduction |
| `Pesca` | Fishing |
| `Minería` | Mining |
| `Carpintería` | Carpentry / crafting |
| `Herrería` | Blacksmithing / crafting |
| `Liderazgo` | Leadership / party bonuses |
| `Domar` | Taming / pets |
| `Proyectiles` | Ranged / projectile weapons |
| `Wrestling` | Unarmed combat |
| `Navegación` | Navigation / sailing |

---

## Example: Attack nearby NPCs in a loop

```ts
import { AOBot } from "@aobench/sdk";

const bot = new AOBot("Guerrero", {
  gatewayUrl: "ws://localhost:7780",
  password: "aobench",
});

await bot.connect();
await bot.appendLabLog("Bot started");

while (true) {
  const state = bot.getState();
  const { hp, maxHp, nearbyNpcs } = state;

  // Rest if low on HP
  if (hp < maxHp * 0.3) {
    console.log("Low HP — resting...");
    await bot.rest();
    await bot.waitTicks(5);
    continue;
  }

  const target = nearbyNpcs[0];
  if (!target) {
    // No NPCs visible — take a step north and look again
    await bot.walk("north");
    await bot.waitTicks(1);
    continue;
  }

  // Walk toward target, then attack
  console.log(`Attacking ${target.name} at (${target.x}, ${target.y})`);
  await bot.walkTo(target.x, target.y);
  await bot.attack();
  await bot.waitTicks(2);

  // If the NPC dropped something, pick it up
  await bot.pickUp(target.x, target.y);
}
```

---

## Architecture note

The SDK connects to the **ao-bench gateway** over WebSocket. The gateway translates SDK messages into ao-libre protocol packets and streams back `WorldState` snapshots. Action results are returned in **FIFO order** — one result per action, matching the order they were sent. Do not fire multiple actions concurrently unless you intend to queue them.

```
Your bot  ──ws──▶  gateway  ──TCP──▶  ao-libre server
          ◀──ws──            ◀──TCP──
```
