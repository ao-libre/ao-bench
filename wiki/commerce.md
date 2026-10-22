# Commerce and Interaction

Sourced from the ao-libre community wiki (v0.13.x).

---

## NPC Commerce

Currency is gold (oro). Agents interact with merchants entirely through SDK calls — there is no GUI to click.

```ts
// 1. Target the merchant NPC by left-clicking its tile
await bot.leftClick(MERCHANT_X, MERCHANT_Y);
await bot.waitTicks(1);

// 2. Open the commerce window
await bot.commerceStart();
await bot.waitTicks(1);

// 3. Buy from shop slot N, quantity Q
//    Shop slots are 1-indexed. Slot numbering depends on the specific shop.
await bot.commerceBuy(slotNumber, amount);
await bot.waitTicks(1);

// 4. Sell from inventory slot N, quantity Q
await bot.commerceSell(inventorySlot, amount);
await bot.waitTicks(1);

// 5. Close the commerce window
await bot.commerceEnd();
```

**Finding slot numbers:** The shop's slot layout is not exposed in `WorldState`. You must discover slot numbers experimentally or from the items DAT data. For the first visit, buy slot 1 and observe what appears in your inventory. Write findings to `lab_log.md`.

**Gold check before buying:** Check `getState().gold` first — the buy will silently fail if you don't have enough gold.

```ts
const s = bot.getState();
if (s.gold >= ITEM_PRICE) {
  await bot.commerceStart();
  await bot.commerceBuy(1, 1);
  await bot.commerceEnd();
} else {
  await bot.appendLabLog("Not enough gold to buy — need " + ITEM_PRICE + ", have " + s.gold);
}
```

### NPC shop types (by sign/NPC)

| Shop type | What it sells |
|-----------|---------------|
| Tienda de provisiones | Food (comida) |
| Herrería | Weapons (armas). Also has an anvil (yunque) and forge (fragua) for Herrería skill. |
| Armería | Armor (armaduras), shields, helmets, etc. |
| Magia | Magic items |
| Pescadería | Fishing supplies: fish, rods, etc. |
| Carpintería | Wood supplies: logs (leños), axes (hachas), etc. |
| Minería | Mining supplies: minerals, pickaxes (picos), etc. |
| Pociones | Potions |
| Taberna | Drinks (bebidas) |
| Venta de Propiedades | Houses (casas) — buy empty properties |
| Mercader compra-todo | General merchant — buys almost any item |
| Apostador | Gambler — `/APOSTAR X` bets 1–5000 gold, win doubles it |
| Entrenador | Trainer — `/ENTRENAR` summons creatures to fight in the Coliseo arena |

### Key NPCs for agents

| NPC type | SDK action | Notes |
|----------|------------|-------|
| Comerciante (any shop) | `commerceStart()` / `commerceBuy()` / `commerceSell()` / `commerceEnd()` | Double-click or `/COMERCIAR` to open |
| Entrenador (Trainer, type 3) | `train(npc, skill)` | Summons training creatures |
| Banquero (Banker, type 4) | `bankStart()` / `bankDeposit()` / `bankExtractItem()` / `bankEnd()` | Gold and item storage |
| Sacerdote / Resucitador (type 1) | `resucitate()` or `heal()` | Resurrection + HP healing |

---

## Comercio Seguro (Player-to-Player Trade)

Secure player trading — exchange items and gold directly, no dropping on the floor.

Both bots must actively participate. Bot A initiates; Bot B accepts; Bot A then accepts the counter-offer. Up to **20 items + gold** can be traded at once.

```ts
// Bot A (initiator)
await botA.leftClick(BOT_B_X, BOT_B_Y);
await botA.userCommerceOffer(slotA, amount, goldAmount); // offer item from slot + gold
// wait for Bot B to respond...

// Bot B (responder) — must be scripted separately
await botB.userCommerceOffer(slotB, amount, 0);          // counter-offer
await botB.userCommerceOk();                              // accept

// Bot A sees counter-offer and accepts
await botA.userCommerceOk();

// Either bot can end the session
await botA.userCommerceEnd();
```

This requires two bots running in parallel — only relevant for multi-agent scenarios (aobench v2). Single-bot tasks should buy from NPC merchants instead.

---

## World interactions

| Object | How to interact | Notes |
|--------|----------------|-------|
| Doors | Double-click to open/close. Locked doors require a key (use key, then click door). | A key from a property purchase opens/closes that property's door. |
| Portals | Walk over them to teleport. Click to see destination (not all show it). | Same 5-second immunity as map crossing when you arrive. |
| Signs / Tombstones | Double-click to read a description. | |
| Trees (Árboles) | `workLeftClick(x, y)` with an axe equipped — gains Talar XP and produces logs. | |
| Ore deposits (Yacimientos) | `workLeftClick(x, y)` with a pickaxe equipped — gains Minería XP and produces ore. | |
| Forges / Anvils (Fraguas / Yunques) | `craftBlacksmith(itemId)` — gains Herrería XP. | Must be adjacent to the forge/anvil. |
| Water tiles | `useSkill("pesca")` nearby — gains Pesca XP. Or navigate on boats. | |

---

## Hunger, thirst, and energy

**Critical mechanic for long bot runs:**

- Characters have hunger (hambre) and thirst (sed) meters.
- If both are empty, HP and stamina **will not regenerate over time**.
- If a character is unclothed in a dungeon, energy drains and they can die of cold.
- Rain also drains energy — only recovers if under a roof.

**To eat/drink:** `useItem(slotNumber)` where the slot contains food or a drink.

Default bot inventory has basic food and water from provisioner setup — check `getState().inventory` for what's available.

**To make a campfire (fogata) for HP regen:**
1. Drop 3+ logs (leños) on the ground with a dagger equipped.
2. Use skill on the logs to make kindling (ramitas) — requires a standard Daga (not Daga +1 or higher).
3. Double-click the kindling to light a campfire.
4. Stand nearby and type `/DESCANSAR` — rests at the fire and regenerates HP + energy.

In SDK: `rest()` toggles rest mode (HP regeneration). `/DESCANSAR` is not a direct SDK action — use `rest()` instead.
