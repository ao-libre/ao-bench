#!/usr/bin/env node
import { AOBot } from "../aobot.js";
import type { WorldState } from "../types.js";
import { ALL_SKILLS } from "../types.js";

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatState(state: WorldState): string {
  const lines: string[] = [];

  lines.push(`=== Bot: ${state.charname} ===`);
  lines.push(
    `Pos: (${state.pos.x}, ${state.pos.y}) Map ${state.pos.map}  Heading: ${state.heading}`
  );
  lines.push(
    `HP: ${state.hp}/${state.maxHp}  Mana: ${state.mana}/${state.maxMana}  Stamina: ${state.stamina}/${state.maxStamina}`
  );
  lines.push(
    `Gold: ${state.gold}  EXP: ${state.exp}  Level: ${state.level}`
  );

  // Skills
  lines.push("");
  lines.push("Skills:");
  const MAX_SHOWN = 2;
  const skillsToShow = ALL_SKILLS.slice(0, MAX_SHOWN);
  for (const skillName of skillsToShow) {
    const sv = state.skills[skillName];
    const level = sv?.level ?? 0;
    const exp = sv?.exp ?? 0;
    const label = skillName.padEnd(14);
    lines.push(`  ${label} L${level}  (${exp} XP)`);
  }
  if (ALL_SKILLS.length > MAX_SHOWN) {
    lines.push(`  [show all ${ALL_SKILLS.length}]`);
  }

  // Inventory
  lines.push("");
  lines.push("Inventory:");
  if (state.inventory.length === 0) {
    lines.push("  (empty)");
  } else {
    for (const slot of state.inventory) {
      const equippedTag = slot.equipped ? " [equipped]" : "";
      lines.push(
        `  Slot ${slot.slot}: ${slot.name} x${slot.amount}${equippedTag}`
      );
    }
  }

  // Nearby NPCs
  lines.push("");
  lines.push("Nearby NPCs:");
  if (state.nearbyNpcs.length === 0) {
    lines.push("  (none)");
  } else {
    for (const npc of state.nearbyNpcs) {
      lines.push(
        `  #${npc.id} ${npc.name} (${npc.x},${npc.y}) HP ${npc.hp}/${npc.maxHp}`
      );
    }
  }

  // Status effects
  lines.push("");
  const status =
    state.statusEffects.length === 0
      ? "none"
      : state.statusEffects.join(", ");
  lines.push(`Status: ${status}`);

  return lines.join("\n");
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);

const watchFlag = rawArgs.includes("--watch");
const positional = rawArgs.filter((a) => !a.startsWith("--"));

if (positional.length === 0) {
  console.error("Usage: bot-cli <charname> [--watch]");
  process.exit(1);
}

const charname = positional[0] as string;

const bot = new AOBot(charname, {
  gatewayUrl: process.env["GATEWAY_URL"] ?? "ws://localhost:7780",
  password: process.env["BOT_PASSWORD"] ?? "aobench",
  mode: "observe",
});

async function run(): Promise<void> {
  await bot.connect();

  if (!watchFlag) {
    console.log(formatState(bot.getState()));
    bot.disconnect();
    return;
  }

  // --watch mode: print every 600ms on state change
  let lastTimestamp = -1;

  const intervalId = setInterval(() => {
    try {
      const state = bot.getState();
      if (state.timestamp !== lastTimestamp) {
        lastTimestamp = state.timestamp;
        console.clear();
        console.log(formatState(state));
      }
    } catch {
      // State not yet received — wait for next tick
    }
  }, 600);

  process.on("SIGINT", () => {
    clearInterval(intervalId);
    bot.disconnect();
    process.exit(0);
  });
}

run().catch((err: unknown) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
