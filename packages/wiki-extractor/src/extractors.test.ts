import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MINI_OBJ_DAT = [
  "' obj.dat mini fixture",
  "[OBJ1]",
  "Name=Manzana Roja",
  "ObjType=1",
  "Valor=2",
  "",
  "[OBJ2]",
  "Name=Espada Larga",
  "ObjType=2",
  "MinHit=1",
  "MaxHit=8",
  "Valor=210",
  "",
  "[OBJ3]",
  "' no Name field — should be skipped",
  "ObjType=5",
  "",
].join("\r\n");

const MINI_NPCS_DAT = [
  "' NPCs.dat mini fixture",
  "[NPC1]",
  "Name=Oso Polar",
  "NpcType=0",
  "MinHP=2600",
  "MaxHP=2600",
  "MinHIT=65",
  "MaxHIT=100",
  "DEF=0",
  "GiveEXP=3700",
  "Hostile=1",
  "",
  "[NPC2]",
  "' no Name — skip",
  "NpcType=0",
  "",
].join("\r\n");

const MINI_HECHIZOS_DAT = [
  "' Hechizos.dat mini fixture",
  "[HECHIZO1]",
  "Nombre=Antídoto Mágico",
  "PalabrasMagicas=NIHIL VED",
  "MinSkill=10",
  "ManaRequerido=12",
  "StaRequerido=1",
  "Target=1",
  "",
  "[HECHIZO2]",
  "' no Nombre — skip",
  "MinSkill=5",
  "",
].join("\r\n");

// ─── Mock fs.readFileSync ─────────────────────────────────────────────────────

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

const mockedReadFileSync = vi.mocked(fs.readFileSync);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("extractItems", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a markdown table with named items only", async () => {
    mockedReadFileSync.mockReturnValue(MINI_OBJ_DAT);

    const { extractItems } = await import("./extractors.js");
    const md = extractItems("/fake/dat");

    // Header check
    expect(md).toContain("# Items");
    expect(md).toContain("| ID | Name | Type | Value | Min Dmg | Max Dmg |");

    // OBJ1 — Manzana Roja
    expect(md).toContain("Manzana Roja");
    expect(md).toContain("Comida");
    expect(md).toContain("| 1 |");

    // OBJ2 — Espada Larga
    expect(md).toContain("Espada Larga");
    expect(md).toContain("Armas");
    expect(md).toContain("210");
    expect(md).toContain("| 2 |");

    // OBJ3 has no Name — must NOT appear
    expect(md).not.toContain("| 3 |");
  });

  it("shows damage fields for weapons", async () => {
    mockedReadFileSync.mockReturnValue(MINI_OBJ_DAT);
    const { extractItems } = await import("./extractors.js");
    const md = extractItems("/fake/dat");

    // Find the Espada Larga row and verify min/max dmg
    const lines = md.split("\n").filter((l) => l.includes("Espada Larga"));
    expect(lines.length).toBe(1);
    const row = lines[0] ?? "";
    expect(row).toContain("1");  // MinHit
    expect(row).toContain("8");  // MaxHit
  });

  it("uses - for missing numeric fields", async () => {
    mockedReadFileSync.mockReturnValue(MINI_OBJ_DAT);
    const { extractItems } = await import("./extractors.js");
    const md = extractItems("/fake/dat");

    // Manzana Roja has no MinHit/MaxHit
    const lines = md.split("\n").filter((l) => l.includes("Manzana Roja"));
    expect(lines.length).toBe(1);
    const row = lines[0] ?? "";
    // The min dmg and max dmg columns should be "-"
    expect(row).toMatch(/\| - \| - \|$/);
  });
});

describe("extractNpcs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a markdown table with named NPCs only", async () => {
    mockedReadFileSync.mockReturnValue(MINI_NPCS_DAT);
    const { extractNpcs } = await import("./extractors.js");
    const md = extractNpcs("/fake/dat");

    expect(md).toContain("# NPCs");
    expect(md).toContain("| ID | Name | Type | HP | Dmg | DEF | EXP | Hostile |");

    // NPC1
    expect(md).toContain("Oso Polar");
    expect(md).toContain("| 1 |");
    expect(md).toContain("2600");   // HP
    expect(md).toContain("3700");   // EXP
    expect(md).toContain("Yes");    // Hostile=1

    // NPC2 has no Name — must not appear
    expect(md).not.toContain("| 2 |");
  });

  it("shows HP range as single value when MinHP === MaxHP", async () => {
    mockedReadFileSync.mockReturnValue(MINI_NPCS_DAT);
    const { extractNpcs } = await import("./extractors.js");
    const md = extractNpcs("/fake/dat");

    // Oso Polar: MinHP=MaxHP=2600, so just "2600" not "2600-2600"
    expect(md).not.toContain("2600-2600");
    expect(md).toContain("2600");
  });

  it("shows damage as range when min and max differ", async () => {
    mockedReadFileSync.mockReturnValue(MINI_NPCS_DAT);
    const { extractNpcs } = await import("./extractors.js");
    const md = extractNpcs("/fake/dat");

    // Oso Polar: MinHIT=65, MaxHIT=100
    expect(md).toContain("65-100");
  });
});

describe("extractSpells", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a markdown table with named spells only", async () => {
    mockedReadFileSync.mockReturnValue(MINI_HECHIZOS_DAT);
    const { extractSpells } = await import("./extractors.js");
    const md = extractSpells("/fake/dat");

    expect(md).toContain("# Spells");
    expect(md).toContain("| ID | Name | Magic Words | Min Skill | Mana | Stamina |");

    // HECHIZO1
    expect(md).toContain("Antídoto Mágico");
    expect(md).toContain("NIHIL VED");
    expect(md).toContain("| 1 |");
    expect(md).toContain("12"); // Mana

    // HECHIZO2 has no Nombre — must not appear
    expect(md).not.toContain("| 2 |");
  });
});

describe("extractSkills", () => {
  it("contains all 20 skill entries", async () => {
    const { extractSkills } = await import("./extractors.js");
    const md = extractSkills();

    expect(md).toContain("# Skills Guide");
    expect(md).toContain("20 skills");

    // All 20 skill names
    const expectedSkills = [
      "Magia",
      "Robar",
      "Tácticas",
      "Armas a Distancia",
      "Defensa con Armas",
      "Evasión",
      "Apuñalar",
      "Orientación",
      "Supervivencia",
      "Pesca",
      "Minería",
      "Leñadora",
      "Herrería",
      "Carpintería",
      "Domar",
      "Liderazgo",
      "Comercio",
      "Proyectiles",
      "Ocultarse",
      "Meditar",
    ];

    for (const skill of expectedSkills) {
      expect(md, `Expected skill "${skill}" to be present`).toContain(skill);
    }

    // Should have exactly 20 data rows in the table
    const tableRows = md
      .split("\n")
      .filter((l) => l.startsWith("|"))
      .filter((l) => !/^\|[\s\-|]+\|$/.test(l)) // drop separators
      .slice(1); // drop header row
    expect(tableRows.length).toBe(20);
  });
});
