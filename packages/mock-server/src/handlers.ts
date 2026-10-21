import type { BotApiRequest, BotApiResponse, BotApiStateResponse } from "../../sdk/src/types.js";
import type { BotState } from "./state.js";
import type { Heading } from "../../sdk/src/types.js";

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

export function handleRequest(req: BotApiRequest, bot: BotState): BotApiResponse {
  switch (req.action) {
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
        // Respawn NPC after 3s
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
      const s = bot.world.skills[skill as keyof typeof bot.world.skills];
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
      const s = bot.world.skills[skill as keyof typeof bot.world.skills];
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

    default:
      return { ok: false, error: `Unknown action: ${req.action}` };
  }
}
