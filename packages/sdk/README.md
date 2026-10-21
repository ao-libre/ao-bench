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

## WorldState reference

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

## AOBot Constructor

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

### Core

| Method | Description |
|--------|-------------|
| `connect()` | Connect to gateway — opens WebSocket, authenticates, waits for `connected` message. Rejects on timeout (10 s) or auth error. |
| `disconnect()` | Close the WebSocket immediately. |
| `getState()` | Return the latest `WorldState`. Throws if not connected or no state received yet. |
| `waitTicks(n)` | Wait `n` × 600 ms. |
| `runScript(opts, fn)` | Connect, run `fn(bot)`, disconnect — even if `fn` throws. |
| `appendLabLog(text)` | Append a timestamped line to `./lab_log.md`. Never throws. |
| `bugReport(description)` | POST a bug report with current state to `LEADERBOARD_URL/api/bugs`. Never throws. |

### Movement

| Method | Description |
|--------|-------------|
| `walk(heading)` | Move one tile in the given direction (`north \| south \| east \| west`). |
| `walkTo(x, y)` | Walk toward tile `(x, y)`, preferring x-axis movement. Max 200 steps. |
| `changeHeading(heading)` | Turn to face a direction without moving. |
| `home()` | Teleport to home city. |

### Combat

| Method | Description |
|--------|-------------|
| `attack()` | Attack the current target (NPC or player). |
| `castSpell(slot)` | Cast the spell in hotbar slot 1–35. |
| `useSpellMacro()` | Cast the spell bound to macro slot 1. |
| `dragSpell(from, to)` | Move a spell from macro slot `from` to slot `to`. |

### Interaction

| Method | Description |
|--------|-------------|
| `leftClick(x, y)` | Left-click tile `(x, y)` — targets an NPC or player. |
| `doubleClick(x, y)` | Double-click tile `(x, y)` — opens NPC dialogue or a door. |
| `workLeftClick(x, y)` | Use skill on a specific tile (mine node, tree, etc.). |
| `pickUp(x, y)` | Pick up an item from tile `(x, y)`. |
| `shareNpc()` | Share the current NPC target with your party. |
| `stopSharingNpc()` | Stop sharing the NPC target. |

### Inventory

| Method | Description |
|--------|-------------|
| `useItem(slot)` | Use the item in inventory slot `slot` (1-based). |
| `equipItem(slot)` | Equip or unequip the item in slot `slot`. |
| `drop(slot, amount)` | Drop `amount` units from inventory slot `slot`. |
| `moveItem(from, to)` | Move an item from slot `from` to slot `to`. |

### Skills & Work

| Method | Description |
|--------|-------------|
| `useSkill(skill)` | Use a skill by name (see Skills reference below). |
| `work(skill)` | Alias for `useSkill`. |
| `train(npc, skill)` | Train `skill` at NPC trainer with index `npc`. |
| `meditate()` | Toggle meditation (mana regeneration). |
| `rest()` | Toggle resting (HP regeneration). |
| `craftBlacksmith(item)` | Craft item with ID `item` at a blacksmith forge. |
| `craftCarpenter(item)` | Craft item with ID `item` at a carpenter bench. |

### Chat

| Method | Description |
|--------|-------------|
| `say(message)` | Send a message in local chat. |
| `yell(message)` | Yell city-wide. |
| `whisper(target, message)` | Send a private message to `target`. |
| `partyMessage(message)` | Send a message to your party. |
| `guildMessage(message)` | Send a message to your guild. |
| `changeDescription(desc)` | Change your character's description text. |

### Commerce (NPC)

| Method | Description |
|--------|-------------|
| `commerceStart()` | Open an NPC shop (target the merchant first). |
| `commerceBuy(slot, amount)` | Buy `amount` of the item in shop slot `slot`. |
| `commerceSell(slot, amount)` | Sell `amount` of the item in inventory slot `slot`. |
| `commerceEnd()` | Close the NPC shop. |

### Commerce (Player)

| Method | Description |
|--------|-------------|
| `userCommerceOffer(slot, amount, gold?)` | Offer `amount` of inventory slot `slot` in a player trade; optionally include `gold`. |
| `userCommerceOk()` | Accept the current player trade. |
| `userCommerceReject()` | Reject the current player trade. |
| `userCommerceEnd()` | End the trade session. |

### Bank

| Method | Description |
|--------|-------------|
| `bankStart()` | Open the bank (stand next to a banker NPC first). |
| `bankDeposit(slot, amount)` | Deposit `amount` of inventory slot `slot`. |
| `bankExtractItem(slot, amount)` | Withdraw `amount` of bank slot `slot`. |
| `bankDepositGold(amount)` | Deposit `amount` gold. |
| `bankExtractGold(amount)` | Withdraw `amount` gold. |
| `bankEnd()` | Close the bank. |

### Party

| Method | Description |
|--------|-------------|
| `partyCreate()` | Create a new party. |
| `partyJoin(leader)` | Join the party led by `leader` (character name). |
| `partyLeave()` | Leave the current party. |

### Faction / Social

| Method | Description |
|--------|-------------|
| `enlist()` | Join an army faction. |
| `resucitate()` | Ask an NPC to resurrect you (when dead). |
| `heal()` | Ask an NPC healer for healing. |

### GM Actions (require GM privileges)

| Method | Description |
|--------|-------------|
| `gmGoToChar(target)` | Teleport yourself to `target`. |
| `gmWarpChar(target, map, x, y)` | Teleport `target` to map `map` at `(x, y)`. |
| `gmWarpMe()` | Teleport yourself to the current target's location. |
| `gmSummon(target)` | Summon `target` to your location. |
| `gmSpawn(npcId)` | Spawn NPC with ID `npcId` at your current position. |
| `gmKillNpc(npcIndex)` | Kill the NPC with index `npcIndex`. |
| `gmKillAllNearby()` | Kill all NPCs currently visible on screen. |
| `gmCreateItem(itemId, amount?)` | Create `amount` (default 1) of item `itemId` in your inventory. |
| `gmDestroyItems()` | Destroy all items on the ground at your position. |
| `gmRevive(target)` | Revive the dead character `target`. |
| `gmKick(target)` | Kick `target` from the server. |
| `gmBan(target, reason)` | Ban `target` with the given `reason`. |
| `gmSilence(target)` | Silence `target` (mute chat). |
| `gmJail(target)` | Send `target` to jail. |
| `gmInvisible()` | Toggle GM invisibility. |
| `gmMessage(message)` | Broadcast `message` to all players. |
| `gmServerMessage(message)` | Send a server-wide system message. |
| `gmRain()` | Toggle rain weather effect. |
| `gmTeleportCreate(map, x, y, dMap, dX, dY)` | Create a teleport tile at `(map, x, y)` that sends players to `(dMap, dX, dY)`. |
| `gmEditChar(target, field, value)` | Modify a character stat field (field and value are numeric IDs). |
| `gmSetDesc(target, desc)` | Set `target`'s character description. |
| `gmCreateNpc(npcId)` | Create NPC `npcId` at your location. |
| `gmMakeDumb(target)` | Block `target` from casting spells. |
| `gmMakeDumbNoMore(target)` | Remove the dumb (spell-blocked) effect from `target`. |
| `gmRequestCharInfo(target)` | Request detailed character info for `target`. |

---

## Skills reference

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

## Example bot script

The script below shows a woodcutter that forms a party, banks its gold, sells
logs to an NPC merchant, and handles HP recovery — illustrating `walkTo`,
`workLeftClick`, `bankDepositGold`, `commerceSell`, `partyCreate`, and more.

```ts
import { AOBot } from "@aobench/sdk";

const BANK_X = 52;
const BANK_Y = 18;
const MERCHANT_X = 54;
const MERCHANT_Y = 20;
const TREE_X = 70;
const TREE_Y = 35;
const LOG_ITEM_ID = 30; // item ID for logs in ao-libre

const bot = new AOBot("Leñador", {
  gatewayUrl: "ws://localhost:7780",
  password: "aobench",
  mode: "control",
});

await bot.connect();
await bot.appendLabLog("Leñador started");

// Create a party so teammates can join
await bot.partyCreate();
await bot.say("Partido creado, únanse!");

// Main loop
while (true) {
  const state = bot.getState();
  const { hp, maxHp, gold, inventory } = state;

  // Heal if low HP
  if (hp < maxHp * 0.3) {
    await bot.appendLabLog(`Low HP (${hp}/${maxHp}), resting...`);
    await bot.rest();
    await bot.waitTicks(5);
    await bot.rest(); // toggle off
    continue;
  }

  // Count logs in inventory
  const logs = inventory.filter((s) => s.itemId === LOG_ITEM_ID);
  const logSlot = logs[0]?.slot;

  // Bank gold when carrying 1000+
  if (gold >= 1000) {
    await bot.appendLabLog(`Banking ${gold} gold`);
    await bot.walkTo(BANK_X, BANK_Y);
    await bot.doubleClick(BANK_X, BANK_Y); // open banker dialogue
    await bot.waitTicks(1);
    await bot.bankStart();
    await bot.bankDepositGold(gold);
    await bot.bankEnd();
    await bot.waitTicks(1);
  }

  // Sell logs when inventory slot is full (amount >= 100)
  if (logSlot !== undefined && logs[0].amount >= 100) {
    await bot.appendLabLog(`Selling ${logs[0].amount} logs`);
    await bot.walkTo(MERCHANT_X, MERCHANT_Y);
    await bot.doubleClick(MERCHANT_X, MERCHANT_Y);
    await bot.waitTicks(1);
    await bot.commerceStart();
    await bot.commerceSell(logSlot, logs[0].amount);
    await bot.commerceEnd();
    await bot.waitTicks(1);
  }

  // Walk to tree and chop
  await bot.walkTo(TREE_X, TREE_Y);
  await bot.workLeftClick(TREE_X, TREE_Y);
  await bot.waitTicks(3);

  // Pick up any dropped logs
  await bot.pickUp(TREE_X, TREE_Y);
  await bot.waitTicks(1);
}
```

---

## Architecture note

The SDK connects to the **ao-bench gateway** over WebSocket. The gateway
translates SDK messages into ao-libre protocol packets and streams back
`WorldState` snapshots. Action results are returned in **FIFO order** — one
result per action, matching the order they were sent. Do not fire multiple
actions concurrently unless you intend to queue them.

```
Your bot  ──ws──▶  gateway  ──TCP──▶  ao-libre server
          ◀──ws──            ◀──TCP──
```
