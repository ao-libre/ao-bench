import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";

import {
  provisionBot,
  deprovisionBot,
  botExists,
  listAccountBots,
  buildCharfile,
  buildAccFile,
  buildAchFile,
  deriveAccountHash,
} from "./provisioner.js";

describe("provisioner", () => {
  const tmpDirs: string[] = [];

  function makeTmpDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aobench-test-"));
    tmpDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  // ── Charfile ──────────────────────────────────────────────────────────────

  it("provisionBot creates uppercase .chr file", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("testbot", { charfileDir });

    const expectedFile = path.join(charfileDir, "TESTBOT.chr");
    expect(fs.existsSync(expectedFile)).toBe(true);
    expect(creds.charfilePath).toBe(expectedFile);
    expect(creds.charname).toBe("testbot");
  });

  it("botExists returns false before provision, true after", () => {
    const charfileDir = makeTmpDir();
    expect(botExists("mybot", { charfileDir })).toBe(false);
    provisionBot("mybot", { charfileDir });
    expect(botExists("mybot", { charfileDir })).toBe(true);
  });

  it("charfile has correct sections", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("sectionbot", { charfileDir });
    const content = fs.readFileSync(creds.charfilePath, "utf-8");
    expect(content).toContain("[INIT]");
    expect(content).toContain("[STATS]");
    expect(content).toContain("[FLAGS]");
    expect(content).toContain("[SKILLS]");
    expect(content).toContain("[CONTACTO]");
    expect(content).toContain("SkillPtsLibres=255");
  });

  it("charfile uses CRLF line endings", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("linebot", { charfileDir });
    const raw = fs.readFileSync(creds.charfilePath, "binary");
    expect(raw).toContain("\r\n");
  });

  it("position is written correctly", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("posbot", { charfileDir, map: 5, x: 42, y: 77 });
    const content = fs.readFileSync(creds.charfilePath, "utf-8");
    expect(content).toContain("Position=5-42-77");
    expect(content).toContain("LastMap=5");
  });

  it("position defaults to map=1 x=50 y=50", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("defaultpos", { charfileDir });
    const content = fs.readFileSync(creds.charfilePath, "utf-8");
    expect(content).toContain("Position=1-50-50");
  });

  it("provisionBot overwrites existing charfile", () => {
    const charfileDir = makeTmpDir();
    provisionBot("overwrite", { charfileDir, map: 1, x: 1, y: 1 });
    provisionBot("overwrite", { charfileDir, map: 2, x: 99, y: 88 });
    const content = fs.readFileSync(path.join(charfileDir, "OVERWRITE.chr"), "utf-8");
    expect(content).toContain("Position=2-99-88");
  });

  // ── Account files ─────────────────────────────────────────────────────────

  it("provisionBot creates .acc file in Account/ dir", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("accbot", { charfileDir });
    const accountDir = path.join(charfileDir, "..", "Account");
    const accFile = path.join(accountDir, "ACCBOT.acc");
    expect(fs.existsSync(accFile)).toBe(true);
    const content = fs.readFileSync(accFile, "utf-8");
    expect(content).toContain("[INIT]");
    expect(content).toContain("Hash=");
  });

  it("provisionBot creates .ach file keyed by account hash", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("achbot", { charfileDir });
    const accountDir = path.join(charfileDir, "..", "Account");
    const achFile = path.join(accountDir, `${creds.accountHash}.ach`);
    expect(fs.existsSync(achFile)).toBe(true);
    const content = fs.readFileSync(achFile, "utf-8");
    expect(content).toContain("[PERSONAJES]");
    expect(content).toContain("ACHBOT");
    expect(content).toContain("CantidadPersonajes=1");
  });

  it("charfile AccountHash matches the .ach filename", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("hashbot", { charfileDir });
    const chrContent = fs.readFileSync(creds.charfilePath, "utf-8");
    expect(chrContent).toContain(`AccountHash=${creds.accountHash}`);
  });

  it("multiple bots under same account share .ach file (up to 10)", () => {
    const charfileDir = makeTmpDir();
    const accountName = "BenchSession01";
    const config = { charfileDir, accountName };

    provisionBot("Bot1", config);
    provisionBot("Bot2", config);
    provisionBot("Bot3", config);

    const bots = listAccountBots(accountName, config);
    expect(bots).toHaveLength(3);
    expect(bots.map(b => b.toUpperCase())).toContain("BOT1");
    expect(bots.map(b => b.toUpperCase())).toContain("BOT2");
    expect(bots.map(b => b.toUpperCase())).toContain("BOT3");
  });

  it("rejects more than 10 chars per account", () => {
    const charfileDir = makeTmpDir();
    const accountName = "FullAccount";
    const config = { charfileDir, accountName };

    for (let i = 1; i <= 10; i++) {
      provisionBot(`Bot${i}`, config);
    }
    expect(() => provisionBot("Bot11", config)).toThrow("maximum");
  });

  it("deprovisionBot removes charfile and updates .ach", () => {
    const charfileDir = makeTmpDir();
    const accountName = "DeprovTest";
    const config = { charfileDir, accountName };

    provisionBot("AlphaBot", config);
    provisionBot("BetaBot", config);

    deprovisionBot("AlphaBot", config);

    expect(botExists("AlphaBot", config)).toBe(false);
    const remaining = listAccountBots(accountName, config);
    expect(remaining.map(b => b.toUpperCase())).not.toContain("ALPHABOT");
    expect(remaining.map(b => b.toUpperCase())).toContain("BETABOT");
  });

  it("deprovisionBot cleans up .acc and .ach when last char removed", () => {
    const charfileDir = makeTmpDir();
    const config = { charfileDir };  // dedicated account per charname

    const creds = provisionBot("lonebot", config);
    const accountDir = path.join(charfileDir, "..", "Account");
    const achPath = path.join(accountDir, `${creds.accountHash}.ach`);
    const accPath = path.join(accountDir, "LONEBOT.acc");

    expect(fs.existsSync(achPath)).toBe(true);
    expect(fs.existsSync(accPath)).toBe(true);

    deprovisionBot("lonebot", config);

    expect(fs.existsSync(achPath)).toBe(false);
    expect(fs.existsSync(accPath)).toBe(false);
  });

  it("deprovisionBot is a no-op if file does not exist", () => {
    const charfileDir = makeTmpDir();
    expect(() => deprovisionBot("ghost", { charfileDir })).not.toThrow();
  });

  // ── Builder functions ─────────────────────────────────────────────────────

  it("buildCharfile embeds accountHash", () => {
    const content = buildCharfile("testchar", { map: 1, x: 50, y: 50, accountHash: "abc123" });
    expect(content).toContain("AccountHash=abc123");
  });

  it("buildAchFile lists all charnames", () => {
    const content = buildAchFile("myaccount", ["Bot1", "Bot2"]);
    expect(content).toContain("CantidadPersonajes=2");
    expect(content).toContain("Personaje1=BOT1");
    expect(content).toContain("Personaje2=BOT2");
  });

  it("buildAchFile throws if more than 10 chars", () => {
    const chars = Array.from({ length: 11 }, (_, i) => `Bot${i + 1}`);
    expect(() => buildAchFile("myaccount", chars)).toThrow("maximum");
  });

  it("deriveAccountHash is deterministic", () => {
    expect(deriveAccountHash("TestAccount")).toBe(deriveAccountHash("TestAccount"));
    expect(deriveAccountHash("TestAccount")).toBe(deriveAccountHash("testaccount")); // case-insensitive
  });

  it("buildAccFile contains Hash field", () => {
    const content = buildAccFile("deadbeef1234");
    expect(content).toContain("Hash=deadbeef1234");
    expect(content).toContain("[INIT]");
  });
});
