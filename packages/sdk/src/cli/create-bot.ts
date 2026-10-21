#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ─── Validation ──────────────────────────────────────────────────────────────

export const USERNAME_REGEX = /^[a-zA-Z0-9]{1,12}$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_REGEX.test(username)) {
    if (username.length > 12) {
      return `Error: username must be at most 12 characters (got ${username.length})`;
    }
    return `Error: username must contain only alphanumeric characters (got "${username}")`;
  }
  return null;
}

// ─── File generators ─────────────────────────────────────────────────────────

export function generateBotEnv(username: string): string {
  return `GATEWAY_URL=ws://localhost:7780
BOT_PASSWORD=aobench
CHARNAME=${username}
`;
}

export function generateScript(username: string): string {
  return `import { AOBot } from '@aobench/sdk';

const bot = new AOBot(process.env.CHARNAME ?? '${username}', {
  gatewayUrl: process.env.GATEWAY_URL,
  password: process.env.BOT_PASSWORD,
});

await bot.runScript({}, async (b) => {
  const state = b.getState();
  await b.appendLabLog(\`Started. HP: \${state.hp}, Pos: \${state.pos.x},\${state.pos.y}\`);

  // TODO: implement your bot strategy here
  for (let i = 0; i < 10; i++) {
    const s = b.getState();
    if (s.nearbyNpcs.length > 0) {
      await b.attack();
    } else {
      await b.walk('south');
    }
    await b.waitTicks(1);
    console.log(\`XP: \${b.getState().exp}\`);
  }
});
`;
}

export function generateLabLog(username: string): string {
  return `# Lab Log — ${username}

This file is your persistent notepad. The harness injects it into your context at the start of each run.
Add observations, strategies, and findings here.

## Notes

`;
}

// ─── Create bot ──────────────────────────────────────────────────────────────

export function createBot(username: string, baseDir: string = "."): void {
  const botDir = join(baseDir, "bots", username);

  if (existsSync(botDir)) {
    console.error(`Error: directory already exists: bots/${username}/`);
    process.exit(1);
  }

  mkdirSync(botDir, { recursive: true });

  writeFileSync(join(botDir, "bot.env"), generateBotEnv(username), "utf8");
  writeFileSync(join(botDir, "script.ts"), generateScript(username), "utf8");
  writeFileSync(join(botDir, "lab_log.md"), generateLabLog(username), "utf8");

  console.log(`Created bot: bots/${username}/`);
  console.log(`  bots/${username}/bot.env`);
  console.log(`  bots/${username}/script.ts`);
  console.log(`  bots/${username}/lab_log.md`);
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

// Only execute when run directly (not when imported by tests).
const isMain =
  process.argv[1] != null &&
  (process.argv[1].endsWith("create-bot.ts") ||
    process.argv[1].endsWith("create-bot.js"));

if (isMain) {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error("Usage: create-bot <username>");
    console.error("  username: alphanumeric, max 12 characters");
    process.exit(1);
  }

  const username = args[0] as string;
  const validationError = validateUsername(username);
  if (validationError !== null) {
    console.error(validationError);
    process.exit(1);
  }

  createBot(username);
}
