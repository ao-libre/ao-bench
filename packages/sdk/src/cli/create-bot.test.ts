import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  USERNAME_REGEX,
  createBot,
  generateBotEnv,
  generateScript,
  generateLabLog,
} from "./create-bot.js";

// ─── Validation tests ────────────────────────────────────────────────────────

describe("username validation regex", () => {
  it("passes for a valid alphanumeric username", () => {
    expect(USERNAME_REGEX.test("Bot1")).toBe(true);
  });

  it("fails for a username longer than 12 characters", () => {
    expect(USERNAME_REGEX.test("this_is_too_long_name")).toBe(false);
  });

  it("fails for a username containing a dash", () => {
    expect(USERNAME_REGEX.test("Bot-1")).toBe(false);
  });

  it("passes for a 12-character alphanumeric username (boundary)", () => {
    expect(USERNAME_REGEX.test("AbcDef123456")).toBe(true);
  });

  it("fails for a 13-character username (boundary over)", () => {
    expect(USERNAME_REGEX.test("AbcDef1234567")).toBe(false);
  });

  it("fails for empty string", () => {
    expect(USERNAME_REGEX.test("")).toBe(false);
  });

  it("fails for username with underscore", () => {
    expect(USERNAME_REGEX.test("Bot_1")).toBe(false);
  });

  it("fails for username with space", () => {
    expect(USERNAME_REGEX.test("Bot 1")).toBe(false);
  });
});

// ─── File creation tests ─────────────────────────────────────────────────────

describe("createBot file creation", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("creates the expected 3 files for username Bot1", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "aobench-test-"));

    createBot("Bot1", tmpDir);

    const botDir = join(tmpDir, "bots", "Bot1");
    expect(existsSync(botDir)).toBe(true);

    const envPath = join(botDir, "bot.env");
    const scriptPath = join(botDir, "script.ts");
    const logPath = join(botDir, "lab_log.md");

    expect(existsSync(envPath)).toBe(true);
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(logPath)).toBe(true);
  });

  it("bot.env contains correct CHARNAME, GATEWAY_URL, BOT_PASSWORD", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "aobench-test-"));

    createBot("Bot1", tmpDir);

    const envContent = readFileSync(
      join(tmpDir, "bots", "Bot1", "bot.env"),
      "utf8"
    );
    expect(envContent).toContain("CHARNAME=Bot1");
    expect(envContent).toContain("GATEWAY_URL=ws://localhost:7780");
    expect(envContent).toContain("BOT_PASSWORD=aobench");
  });

  it("script.ts contains the username", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "aobench-test-"));

    createBot("Bot1", tmpDir);

    const scriptContent = readFileSync(
      join(tmpDir, "bots", "Bot1", "script.ts"),
      "utf8"
    );
    expect(scriptContent).toContain("Bot1");
    expect(scriptContent).toContain("@aobench/sdk");
  });

  it("lab_log.md contains the username in the heading", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "aobench-test-"));

    createBot("Bot1", tmpDir);

    const logContent = readFileSync(
      join(tmpDir, "bots", "Bot1", "lab_log.md"),
      "utf8"
    );
    expect(logContent).toContain("# Lab Log — Bot1");
  });
});

// ─── Generator unit tests ─────────────────────────────────────────────────────

describe("generateBotEnv", () => {
  it("includes the username as CHARNAME", () => {
    const env = generateBotEnv("HeroBot");
    expect(env).toContain("CHARNAME=HeroBot");
  });
});

describe("generateScript", () => {
  it("uses the username in the fallback charname expression", () => {
    const script = generateScript("HeroBot");
    expect(script).toContain("HeroBot");
  });
});

describe("generateLabLog", () => {
  it("includes the username in the heading", () => {
    const log = generateLabLog("HeroBot");
    expect(log).toContain("# Lab Log — HeroBot");
  });
});
