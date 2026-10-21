import type { BotApiRequest, BotApiResponse, BotApiStateResponse } from "../../sdk/src/types.js";
import type { BotState } from "./state.js";
import type { Heading, SkillName, StatusEffect } from "../../sdk/src/types.js";

const DIRECTION_DELTA: Record<Heading, [number, number]> = {
  north: [0, -1],
  south: [0, 1],
  east: [1, 0],
  west: [-1, 0],
};

function stateResponse(bot: BotState): BotApiStateResponse {
  // Apply pending XP
  if (bot.pendingXp > 0) {
    bot.world.exp += bot.pendingXp;
    bot.pendingXp = 0;
  }
  bot.world.timestamp = Date.now();
  return { ok: true, state: { ...bot.world } };
}

/** Find the next free inventory slot at or above minSlot. */
function nextFreeSlot(bot: BotState, minSlot = 1): number {
  const occupied = new Set(bot.world.inventory.map((i) => i.slot));
  let s = minSlot;
  while (occupied.has(s)) s++;
  return s;
}

/** Find the next free bank slot. */
function nextFreeBankSlot(bot: BotState): number {
  const occupied = new Set(bot.bank.map((i) => i.slot));
  let s = 1;
  while (occupied.has(s)) s++;
  return s;
}

let _npcIdCounter = 100;

export function handleRequest(req: BotApiRequest, bot: BotState): BotApiResponse {
  switch (req.action) {
    // ─────────────────────────────────────────────────────────────────────────
    // Core / already existing actions
    // ─────────────────────────────────────────────────────────────────────────

    case "getState":
      return stateResponse(bot);

    case "walk": {
      const h = req["heading"] as string | undefined;
      const validHeadings: Heading[] = ["north", "south", "east", "west"];
      if (!h || !validHeadings.includes(h as Heading)) {
        return { ok: false, error: `Invalid heading: ${String(h)}` };
      }
      const delta = DIRECTION_DELTA[h as Heading];
      bot.world.pos = {
        ...bot.world.pos,
        x: bot.world.pos.x + delta[0],
        y: bot.world.pos.y + delta[1],
      };
      bot.world.heading = h as Heading;
      return { ok: true, moved: true, pos: bot.world.pos };
    }

    case "attack": {
      const npc = bot.world.nearbyNpcs[0];
      if (!npc) {
        return { ok: false, error: "No NPC in range" };
      }
      const damage = 5 + Math.floor(Math.random() * 10);
      bot.npcHp = Math.max(0, bot.npcHp - damage);
      npc.hp = bot.npcHp;
      const killed = bot.npcHp <= 0;
      if (killed) {
        bot.pendingXp += 50;
        bot.world.skills["Armas"].exp += 10;
        setTimeout(() => {
          bot.npcHp = npc.maxHp;
          npc.hp = npc.maxHp;
          npc.x = 51;
          npc.y = 50;
        }, 3000);
      }
      return { ok: true, damage, killed };
    }

    case "castSpell": {
      const slot = req["slot"] as number | undefined;
      if (typeof slot !== "number" || slot < 1 || slot > 20) {
        return { ok: false, error: "slot must be 1-20" };
      }
      const manaCost = 10;
      if (bot.world.mana < manaCost) {
        return { ok: false, error: "Not enough mana" };
      }
      bot.world.mana -= manaCost;
      bot.world.skills["Magia"].exp += 5;
      return { ok: true, spellSlot: slot };
    }

    case "useItem": {
      const slot = req["slot"] as number | undefined;
      if (typeof slot !== "number") {
        return { ok: false, error: "slot is required" };
      }
      const item = bot.world.inventory.find((i) => i.slot === slot);
      if (!item) {
        return { ok: false, error: `No item in slot ${slot}` };
      }
      if (item.name.includes("Pocion de Vida")) {
        const healed = Math.min(30, bot.world.maxHp - bot.world.hp);
        bot.world.hp += healed;
        item.amount -= 1;
        if (item.amount <= 0) {
          bot.world.inventory = bot.world.inventory.filter((i) => i.slot !== slot);
        }
        return { ok: true, healed };
      }
      return { ok: true };
    }

    case "useSkill": {
      const skill = req["skill"] as string | undefined;
      if (!skill) {
        return { ok: false, error: "skill is required" };
      }
      const s = bot.world.skills[skill as SkillName];
      if (!s) {
        return { ok: false, error: `Unknown skill: ${skill}` };
      }
      s.exp += 8;
      bot.pendingXp += 5;
      return { ok: true, skill };
    }

    case "work": {
      const skill = req["skill"] as string | undefined;
      if (!skill) {
        return { ok: false, error: "skill is required" };
      }
      const s = bot.world.skills[skill as SkillName];
      if (!s) {
        return { ok: false, error: `Unknown skill: ${skill}` };
      }
      s.exp += 12;
      bot.pendingXp += 3;
      return { ok: true, skill };
    }

    case "leftClick": {
      const x = req["x"] as number | undefined;
      const y = req["y"] as number | undefined;
      if (typeof x !== "number" || typeof y !== "number") {
        return { ok: false, error: "x and y are required" };
      }
      return { ok: true, clicked: { x, y } };
    }

    case "say":
    case "yell":
    case "whisper": {
      const msg = req["message"] as string | undefined;
      if (!msg) {
        return { ok: false, error: "message is required" };
      }
      return { ok: true, sent: msg };
    }

    case "pickUp":
      return { ok: true };

    case "equipItem": {
      const slot = req["slot"] as number | undefined;
      if (typeof slot !== "number") {
        return { ok: false, error: "slot is required" };
      }
      return { ok: true, equipped: slot };
    }

    case "meditate":
      return { ok: true, meditating: true };

    case "rest":
      return { ok: true, resting: true };

    case "drop": {
      const slot = req["slot"] as number | undefined;
      const amount = req["amount"] as number | undefined;
      if (typeof slot !== "number" || typeof amount !== "number") {
        return { ok: false, error: "slot and amount are required" };
      }
      return { ok: true, dropped: { slot, amount } };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Movement / interaction
    // ─────────────────────────────────────────────────────────────────────────

    case "doubleClick": {
      const x = req["x"] as number | undefined;
      const y = req["y"] as number | undefined;
      if (typeof x !== "number" || typeof y !== "number") {
        return { ok: false, error: "x and y are required" };
      }
      const npc = bot.world.nearbyNpcs.find((n) => n.x === x && n.y === y);
      if (npc) {
        return { ok: true, interacted: npc.name };
      }
      return { ok: true, clicked: { x, y } };
    }

    case "changeHeading": {
      const heading = req["heading"] as string | undefined;
      const validHeadings: Heading[] = ["north", "south", "east", "west"];
      if (!heading || !validHeadings.includes(heading as Heading)) {
        return { ok: false, error: `Invalid heading: ${String(heading)}` };
      }
      bot.world.heading = heading as Heading;
      return { ok: true };
    }

    case "workLeftClick": {
      const x = req["x"] as number | undefined;
      const y = req["y"] as number | undefined;
      if (typeof x !== "number" || typeof y !== "number") {
        return { ok: false, error: "x and y are required" };
      }
      // Alternate between Talar and Minería based on accumulated xp parity
      const skillName: SkillName = bot.pendingXp % 2 === 0 ? "Talar" : "Minería";
      bot.world.skills[skillName].exp += 15;
      bot.pendingXp += 3;
      return { ok: true, worked: { x, y } };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Spells / items
    // ─────────────────────────────────────────────────────────────────────────

    case "useSpellMacro": {
      const manaCost = 10;
      if (bot.world.mana < manaCost) {
        return { ok: false, error: "Not enough mana" };
      }
      bot.world.mana -= manaCost;
      bot.world.skills["Magia"].exp += 5;
      return { ok: true };
    }

    case "moveItem": {
      const from = req["from"] as number | undefined;
      const to = req["to"] as number | undefined;
      if (typeof from !== "number" || typeof to !== "number") {
        return { ok: false, error: "from and to are required" };
      }
      const fromItem = bot.world.inventory.find((i) => i.slot === from);
      const toItem = bot.world.inventory.find((i) => i.slot === to);
      if (fromItem) fromItem.slot = to;
      if (toItem) toItem.slot = from;
      return { ok: true };
    }

    case "dragSpell": {
      // No spell slot state tracked in mock — just ack.
      return { ok: true };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NPC Commerce
    // ─────────────────────────────────────────────────────────────────────────

    case "commerceStart":
      bot.isInCommerce = true;
      return { ok: true, inCommerce: true };

    case "commerceBuy": {
      if (!bot.isInCommerce) {
        return { ok: false, error: "Not in commerce" };
      }
      const slot = req["slot"] as number | undefined;
      const amount = (req["amount"] as number | undefined) ?? 1;
      if (typeof slot !== "number") {
        return { ok: false, error: "slot is required" };
      }
      const freeSlot = nextFreeSlot(bot, 3);
      bot.world.inventory.push({
        slot: freeSlot,
        itemId: 200 + slot,
        name: `Item #${slot}`,
        amount,
        equipped: false,
      });
      bot.world.gold = Math.max(0, bot.world.gold - amount * 10);
      return { ok: true, bought: { slot, amount } };
    }

    case "commerceSell": {
      if (!bot.isInCommerce) {
        return { ok: false, error: "Not in commerce" };
      }
      const slot = req["slot"] as number | undefined;
      const amount = (req["amount"] as number | undefined) ?? 1;
      if (typeof slot !== "number") {
        return { ok: false, error: "slot is required" };
      }
      const item = bot.world.inventory.find((i) => i.slot === slot);
      if (!item) {
        return { ok: false, error: `No item in slot ${slot}` };
      }
      item.amount -= amount;
      if (item.amount <= 0) {
        bot.world.inventory = bot.world.inventory.filter((i) => i.slot !== slot);
      }
      bot.world.gold += amount * 5;
      return { ok: true, sold: slot };
    }

    case "commerceEnd":
      bot.isInCommerce = false;
      return { ok: true };

    // ─────────────────────────────────────────────────────────────────────────
    // Player-to-player trade
    // ─────────────────────────────────────────────────────────────────────────

    case "userCommerceOffer": {
      const slot = req["slot"] as number | undefined;
      const amount = (req["amount"] as number | undefined) ?? 1;
      const gold = (req["gold"] as number | undefined) ?? 0;
      if (typeof slot !== "number") {
        return { ok: false, error: "slot is required" };
      }
      bot.isInUserCommerce = true;
      const item = bot.world.inventory.find((i) => i.slot === slot);
      if (item) {
        bot.commerceOffer.push({ ...item, amount });
      } else {
        // Offering gold only
        bot.commerceOffer.push({ slot: 0, itemId: 1, name: "Oro", amount: gold, equipped: false });
      }
      return { ok: true };
    }

    case "userCommerceOk":
      bot.commerceOffer = [];
      bot.isInUserCommerce = false;
      return { ok: true };

    case "userCommerceReject":
    case "userCommerceEnd":
      bot.commerceOffer = [];
      bot.isInUserCommerce = false;
      return { ok: true };

    // ─────────────────────────────────────────────────────────────────────────
    // Bank
    // ─────────────────────────────────────────────────────────────────────────

    case "bankStart":
      bot.isInBank = true;
      return { ok: true, inBank: true };

    case "bankDeposit": {
      const slot = req["slot"] as number | undefined;
      const amount = (req["amount"] as number | undefined) ?? 1;
      if (typeof slot !== "number") {
        return { ok: false, error: "slot is required" };
      }
      const item = bot.world.inventory.find((i) => i.slot === slot);
      if (!item) {
        return { ok: false, error: `No item in slot ${slot}` };
      }
      const bankSlot = nextFreeBankSlot(bot);
      bot.bank.push({ ...item, slot: bankSlot, amount });
      item.amount -= amount;
      if (item.amount <= 0) {
        bot.world.inventory = bot.world.inventory.filter((i) => i.slot !== slot);
      }
      return { ok: true };
    }

    case "bankExtractItem": {
      const slot = req["slot"] as number | undefined;
      const amount = (req["amount"] as number | undefined) ?? 1;
      if (typeof slot !== "number") {
        return { ok: false, error: "slot is required" };
      }
      const bankItem = bot.bank.find((i) => i.slot === slot);
      if (!bankItem) {
        return { ok: false, error: `No item in bank slot ${slot}` };
      }
      const invSlot = nextFreeSlot(bot);
      bot.world.inventory.push({ ...bankItem, slot: invSlot, amount });
      bankItem.amount -= amount;
      if (bankItem.amount <= 0) {
        bot.bank = bot.bank.filter((i) => i.slot !== slot);
      }
      return { ok: true };
    }

    case "bankDepositGold": {
      const amount = req["amount"] as number | undefined;
      if (typeof amount !== "number" || amount <= 0) {
        return { ok: false, error: "amount is required" };
      }
      if (bot.world.gold < amount) {
        return { ok: false, error: "Not enough gold" };
      }
      bot.world.gold -= amount;
      const bankGold = bot.bank.find((i) => i.itemId === 100);
      if (bankGold) {
        bankGold.amount += amount;
      } else {
        bot.bank.push({ slot: nextFreeBankSlot(bot), itemId: 100, name: "Oro en banco", amount, equipped: false });
      }
      return { ok: true };
    }

    case "bankExtractGold": {
      const amount = req["amount"] as number | undefined;
      if (typeof amount !== "number" || amount <= 0) {
        return { ok: false, error: "amount is required" };
      }
      const bankGold = bot.bank.find((i) => i.itemId === 100);
      if (!bankGold || bankGold.amount < amount) {
        return { ok: false, error: "Not enough gold in bank" };
      }
      bankGold.amount -= amount;
      if (bankGold.amount <= 0) {
        bot.bank = bot.bank.filter((i) => i.itemId !== 100);
      }
      bot.world.gold += amount;
      return { ok: true };
    }

    case "bankEnd":
      bot.isInBank = false;
      return { ok: true };

    // ─────────────────────────────────────────────────────────────────────────
    // Crafting
    // ─────────────────────────────────────────────────────────────────────────

    case "craftBlacksmith": {
      const item = req["item"] as number | undefined;
      if (typeof item !== "number") {
        return { ok: false, error: "item is required" };
      }
      const slot = nextFreeSlot(bot, 5);
      bot.world.inventory.push({ slot, itemId: item, name: `Crafted #${item}`, amount: 1, equipped: false });
      bot.world.skills["Herrería"].exp += 20;
      bot.pendingXp += 5;
      return { ok: true, crafted: item };
    }

    case "craftCarpenter": {
      const item = req["item"] as number | undefined;
      if (typeof item !== "number") {
        return { ok: false, error: "item is required" };
      }
      const slot = nextFreeSlot(bot, 5);
      bot.world.inventory.push({ slot, itemId: item, name: `Crafted #${item}`, amount: 1, equipped: false });
      bot.world.skills["Carpintería"].exp += 20;
      bot.pendingXp += 5;
      return { ok: true, crafted: item };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Training
    // ─────────────────────────────────────────────────────────────────────────

    case "train": {
      const skill = req["skill"] as string | undefined;
      if (!skill) {
        return { ok: false, error: "skill is required" };
      }
      const s = bot.world.skills[skill as SkillName];
      if (!s) {
        return { ok: false, error: `Unknown skill: ${skill}` };
      }
      s.level = Math.min(100, s.level + 10);
      return { ok: true, trained: skill };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Party
    // ─────────────────────────────────────────────────────────────────────────

    case "partyCreate":
      return { ok: true, party: [bot.world.charname] };

    case "partyJoin": {
      const leader = req["leader"] as string | undefined;
      if (!leader) {
        return { ok: false, error: "leader is required" };
      }
      if (!bot.partyMembers.includes(leader)) {
        bot.partyMembers.push(leader);
      }
      return { ok: true };
    }

    case "partyLeave":
      bot.partyMembers = [];
      return { ok: true };

    case "partyMessage": {
      const msg = req["message"] as string | undefined;
      if (!msg) {
        return { ok: false, error: "message is required" };
      }
      return { ok: true, sent: msg };
    }

    case "guildMessage": {
      const msg = req["message"] as string | undefined;
      if (!msg) {
        return { ok: false, error: "message is required" };
      }
      return { ok: true, sent: msg };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // NPC sharing
    // ─────────────────────────────────────────────────────────────────────────

    case "shareNpc":
    case "stopSharingNpc":
      return { ok: true };

    // ─────────────────────────────────────────────────────────────────────────
    // Character state
    // ─────────────────────────────────────────────────────────────────────────

    case "resucitate": {
      const isDead = bot.world.hp <= 0;
      if (isDead) {
        bot.world.hp = Math.floor(bot.world.maxHp / 2);
      }
      return { ok: true, resurrected: isDead };
    }

    case "heal": {
      const amount = 20;
      const actual = Math.min(amount, bot.world.maxHp - bot.world.hp);
      bot.world.hp = Math.min(bot.world.maxHp, bot.world.hp + amount);
      return { ok: true, healed: actual };
    }

    case "home":
      bot.world.pos = { x: 50, y: 50, map: 1 };
      return { ok: true };

    case "enlist":
      return { ok: true, enlisted: true };

    case "changeDescription":
      return { ok: true };

    // ─────────────────────────────────────────────────────────────────────────
    // GM actions
    // ─────────────────────────────────────────────────────────────────────────

    case "gmGoToChar": {
      const target = req["target"] as string | undefined;
      if (!target) {
        return { ok: false, error: "target is required" };
      }
      bot.world.pos = { x: 60, y: 60, map: 1 };
      return { ok: true, warpedTo: target };
    }

    case "gmWarpChar": {
      const target = req["target"] as string | undefined;
      const map = req["map"] as number | undefined;
      const x = req["x"] as number | undefined;
      const y = req["y"] as number | undefined;
      if (!target || typeof map !== "number" || typeof x !== "number" || typeof y !== "number") {
        return { ok: false, error: "target, map, x, y are required" };
      }
      return { ok: true, warped: { target, map, x, y } };
    }

    case "gmWarpMe":
      bot.world.pos = { x: 55, y: 55, map: 1 };
      return { ok: true };

    case "gmSummon": {
      const target = req["target"] as string | undefined;
      if (!target) {
        return { ok: false, error: "target is required" };
      }
      bot.world.nearbyPlayers.push({ name: target, x: bot.world.pos.x + 1, y: bot.world.pos.y, hp: 100, maxHp: 100 });
      return { ok: true, summoned: target };
    }

    case "gmSpawn":
    case "gmCreateNpc": {
      const npc = req["npc"] as number | undefined;
      if (typeof npc !== "number") {
        return { ok: false, error: "npc is required" };
      }
      const npcId = ++_npcIdCounter;
      const newNpc = { id: npcId, name: `NPC#${npc}`, x: bot.world.pos.x + 2, y: bot.world.pos.y, hp: 100, maxHp: 100, type: npc };
      bot.world.nearbyNpcs.push(newNpc);
      bot.spawnedNpcs.push(newNpc);
      return { ok: true, spawned: npcId };
    }

    case "gmKillNpc": {
      const npc = req["npc"] as number | undefined;
      if (typeof npc !== "number") {
        return { ok: false, error: "npc is required" };
      }
      bot.world.nearbyNpcs = bot.world.nearbyNpcs.filter((n) => n.id !== npc);
      return { ok: true, killed: npc };
    }

    case "gmKillAllNearby": {
      const count = bot.world.nearbyNpcs.length;
      bot.world.nearbyNpcs = [];
      bot.pendingXp += 200;
      return { ok: true, killed: count };
    }

    case "gmCreateItem": {
      const item = req["item"] as number | undefined;
      const amount = (req["amount"] as number | undefined) ?? 1;
      if (typeof item !== "number") {
        return { ok: false, error: "item is required" };
      }
      const slot = nextFreeSlot(bot);
      bot.world.inventory.push({ slot, itemId: item, name: `GM Item #${item}`, amount, equipped: false });
      return { ok: true, created: { item, amount } };
    }

    case "gmDestroyItems":
      // Ground items are ephemeral in the mock — no-op.
      return { ok: true };

    case "gmRevive": {
      const target = req["target"] as string | undefined;
      if (!target) {
        return { ok: false, error: "target is required" };
      }
      return { ok: true, revived: target };
    }

    case "gmKick": {
      const target = req["target"] as string | undefined;
      if (!target) {
        return { ok: false, error: "target is required" };
      }
      return { ok: true, kicked: target };
    }

    case "gmBan": {
      const target = req["target"] as string | undefined;
      if (!target) {
        return { ok: false, error: "target is required" };
      }
      return { ok: true, banned: target };
    }

    case "gmSilence": {
      const target = req["target"] as string | undefined;
      if (!target) {
        return { ok: false, error: "target is required" };
      }
      return { ok: true, silenced: target };
    }

    case "gmJail": {
      const target = req["target"] as string | undefined;
      if (!target) {
        return { ok: false, error: "target is required" };
      }
      return { ok: true, jailed: target };
    }

    case "gmInvisible": {
      const effect: StatusEffect = "stunned"; // reuse a known effect as "invisible" placeholder
      // Use a separate marker since StatusEffect doesn't include "invisible"
      const idx = bot.world.statusEffects.indexOf(effect);
      if (idx === -1) {
        bot.world.statusEffects.push(effect);
      } else {
        bot.world.statusEffects.splice(idx, 1);
      }
      return { ok: true };
    }

    case "gmMessage":
    case "gmServerMessage": {
      const message = req["message"] as string | undefined;
      if (!message) {
        return { ok: false, error: "message is required" };
      }
      return { ok: true, broadcast: message };
    }

    case "gmRain":
      return { ok: true, raining: true };

    case "gmTeleportCreate": {
      const map = req["map"] as number | undefined;
      const x = req["x"] as number | undefined;
      const y = req["y"] as number | undefined;
      const destMap = req["destMap"] as number | undefined;
      const destX = req["destX"] as number | undefined;
      const destY = req["destY"] as number | undefined;
      if (
        typeof map !== "number" ||
        typeof x !== "number" ||
        typeof y !== "number" ||
        typeof destMap !== "number" ||
        typeof destX !== "number" ||
        typeof destY !== "number"
      ) {
        return { ok: false, error: "map, x, y, destMap, destX, destY are required" };
      }
      return { ok: true, created: { map, x, y, destMap, destX, destY } };
    }

    case "gmEditChar": {
      const target = req["target"] as string | undefined;
      const field = req["field"] as number | undefined;
      const value = req["value"] as number | undefined;
      if (!target || typeof field !== "number" || typeof value !== "number") {
        return { ok: false, error: "target, field, value are required" };
      }
      if (target === bot.world.charname) {
        if (field === 6) bot.world.level = value;
        else if (field === 1) bot.world.gold = value;
        else if (field === 5) bot.world.exp = value;
      }
      return { ok: true, edited: { field, value } };
    }

    case "gmSetDesc": {
      return { ok: true };
    }

    case "gmMakeDumb":
    case "gmMakeDumbNoMore": {
      return { ok: true };
    }

    case "gmRequestCharInfo": {
      const target = req["target"] as string | undefined;
      if (!target) {
        return { ok: false, error: "target is required" };
      }
      return { ok: true, info: { name: target, level: 1, class: 3 } };
    }

    default:
      return { ok: false, error: `Unknown action: ${req.action}` };
  }
}
