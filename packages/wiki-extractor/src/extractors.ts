import * as fs from "node:fs";
import * as path from "node:path";
import { parseIni } from "./parser.js";

// ─── ObjType map ────────────────────────────────────────────────────────────

const OBJ_TYPE: Record<string, string> = {
  "1": "Comida",
  "2": "Armas",
  "3": "Armaduras",
  "11": "Pociones",
  "14": "Madera",
  "22": "Yacimiento",
  "23": "Metales",
};

// ─── NpcType map ─────────────────────────────────────────────────────────────

const NPC_TYPE: Record<string, string> = {
  "0": "Común",
  "1": "Resucitador",
  "2": "Guardia",
  "3": "Entrenador",
  "4": "Banquero",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Escape pipe chars so they don't break markdown tables. */
function esc(value: string | undefined): string {
  if (value === undefined || value === "") return "-";
  return value.replace(/\|/g, "\\|").replace(/\r/g, "");
}

/** Format a number field or return "-" if missing/zero. */
function num(value: string | undefined): string {
  if (value === undefined || value === "" || value === "0") return "-";
  return value;
}

// ─── Items ───────────────────────────────────────────────────────────────────

/**
 * Extract item data from obj.dat and return a Markdown table.
 * Only includes items with a Name field, up to 500 entries.
 */
export function extractItems(datDir: string): string {
  const filePath = path.join(datDir, "obj.dat");
  const content = fs.readFileSync(filePath, "latin1");
  const ini = parseIni(content);

  const rows: string[] = [];

  for (const [section, data] of ini) {
    if (!section.startsWith("OBJ")) continue;
    if (!("Name" in data)) continue;

    const id = section.slice(3); // "OBJ42" → "42"
    const name = esc(data["Name"]);
    const objType = OBJ_TYPE[data["ObjType"] ?? ""] ?? data["ObjType"] ?? "-";
    const valor = num(data["Valor"]);
    const minHit = num(data["MinHit"]);
    const maxHit = num(data["MaxHit"]);

    rows.push(`| ${id} | ${name} | ${objType} | ${valor} | ${minHit} | ${maxHit} |`);

    if (rows.length >= 500) break;
  }

  const header = [
    "# Items",
    "",
    "| ID | Name | Type | Value | Min Dmg | Max Dmg |",
    "|----|------|------|-------|---------|---------|",
  ];

  return [...header, ...rows].join("\n") + "\n";
}

// ─── NPCs ────────────────────────────────────────────────────────────────────

/**
 * Extract NPC data from NPCs.dat and return a Markdown table.
 * Only includes NPCs with a Name field.
 */
export function extractNpcs(datDir: string): string {
  const filePath = path.join(datDir, "NPCs.dat");
  const content = fs.readFileSync(filePath, "latin1");
  const ini = parseIni(content);

  const rows: string[] = [];

  for (const [section, data] of ini) {
    if (!section.startsWith("NPC")) continue;
    if (!("Name" in data)) continue;

    const id = section.slice(3);
    const name = esc(data["Name"]);
    const npcType = NPC_TYPE[data["NpcType"] ?? ""] ?? data["NpcType"] ?? "-";

    // HP display: MinHP-MaxHP or just MaxHP if both are equal
    const minHP = data["MinHP"] ?? "";
    const maxHP = data["MaxHP"] ?? "";
    const hp =
      minHP && maxHP && minHP !== maxHP
        ? `${minHP}-${maxHP}`
        : maxHP || minHP || "-";

    // Damage display
    const minHIT = data["MinHIT"] ?? "";
    const maxHIT = data["MaxHIT"] ?? "";
    const dmg =
      minHIT && maxHIT && minHIT !== maxHIT
        ? `${minHIT}-${maxHIT}`
        : maxHIT || minHIT || "-";

    const def = num(data["DEF"]);
    const exp = num(data["GiveEXP"]);
    const hostile = data["Hostile"] === "1" ? "Yes" : "No";

    rows.push(`| ${id} | ${name} | ${npcType} | ${hp} | ${dmg} | ${def} | ${exp} | ${hostile} |`);
  }

  const header = [
    "# NPCs",
    "",
    "| ID | Name | Type | HP | Dmg | DEF | EXP | Hostile |",
    "|----|------|------|----|-----|-----|-----|---------|",
  ];

  return [...header, ...rows].join("\n") + "\n";
}

// ─── Spells ──────────────────────────────────────────────────────────────────

/**
 * Extract spell data from Hechizos.dat and return a Markdown table.
 * Only includes spells with a Nombre field.
 */
export function extractSpells(datDir: string): string {
  const filePath = path.join(datDir, "Hechizos.dat");
  const content = fs.readFileSync(filePath, "latin1");
  const ini = parseIni(content);

  const rows: string[] = [];

  for (const [section, data] of ini) {
    if (!section.startsWith("HECHIZO")) continue;
    if (!("Nombre" in data)) continue;

    const id = section.slice(7); // "HECHIZO1" → "1"
    const name = esc(data["Nombre"]);
    const words = esc(data["PalabrasMagicas"]);
    const minSkill = num(data["MinSkill"]);
    const mana = num(data["ManaRequerido"]);
    const stamina = num(data["StaRequerido"]);

    rows.push(`| ${id} | ${name} | ${words} | ${minSkill} | ${mana} | ${stamina} |`);
  }

  const header = [
    "# Spells",
    "",
    "| ID | Name | Magic Words | Min Skill | Mana | Stamina |",
    "|----|------|-------------|-----------|------|---------|",
  ];

  return [...header, ...rows].join("\n") + "\n";
}

// ─── Skills (static) ─────────────────────────────────────────────────────────

/**
 * Returns a static Markdown skills guide for all 20 ao-libre skills.
 */
export function extractSkills(): string {
  return `# Skills Guide

ao-libre has 20 skills (eSkill enum):

| ID | Skill | Description |
|----|-------|-------------|
| 1 | Magia | Cast offensive and support spells; requires Mana |
| 2 | Robar | Steal gold or items from players and NPCs |
| 3 | Tácticas | Melee combat effectiveness and hit chance |
| 4 | Armas a Distancia | Accuracy with bows and ranged weapons |
| 5 | Defensa con Armas | Passive block and parry chance with weapons |
| 6 | Evasión | Dodge incoming attacks |
| 7 | Apuñalar | Backstab and poison attacks |
| 8 | Orientación | Navigate and reveal hidden map areas |
| 9 | Supervivencia | Reduce damage taken in dangerous environments |
| 10 | Pesca | Catch fish in rivers, lakes and seas |
| 11 | Minería | Mine ore and mineral deposits (Yacimientos) |
| 12 | Leñadora | Chop trees and harvest wood (Madera) |
| 13 | Herrería | Forge weapons and armour from metal bars |
| 14 | Carpintería | Craft wooden items, shields and furniture |
| 15 | Domar | Tame wild creatures as pets or mounts |
| 16 | Liderazgo | Boost group members' stats through leadership |
| 17 | Comercio | Negotiate better prices with NPC merchants |
| 18 | Proyectiles | Craft and fletch arrows and projectiles |
| 19 | Ocultarse | Become invisible to other players and NPCs |
| 20 | Meditar | Regenerate Mana and Stamina through meditation |
`;
}

// ─── Maps (static) ───────────────────────────────────────────────────────────

/**
 * Returns a static Markdown map guide.
 * Map.dat has NumMaps=317; individual map files are not parsed.
 */
export function extractMaps(): string {
  return `# Map Zones

ao-libre has 317 maps (Map.dat \`NumMaps=317\`).

Map files live in subdirectories referenced by \`MapPath\` in \`Map.dat\`.
The individual \`.map\` files contain tile data and are not parsed by this tool.

## Key Zones

- **Map 1** — Starting area (Banderbill city centre)
- **Maps 2–10** — Banderbill outskirts and surrounding wilderness
- **Maps 11–30** — Forest regions and beginner hunting grounds
- **Maps 31–60** — Plains, roads between cities
- **Maps 61–100** — Nix and surrounding zones
- **Maps 101–150** — Ullathorpe and castle areas
- **Maps 151–200** — Underground dungeons and caves
- **Maps 201–250** — Advanced monster zones and boss areas
- **Maps 251–300** — Remote wilderness, high-level hunting
- **Maps 301–317** — Special event maps, arenas, and instanced areas

## Dungeon Tiers

| Tier | Maps | Recommended Level |
|------|------|-------------------|
| Beginner | 1–30 | 1–20 |
| Intermediate | 31–100 | 20–50 |
| Advanced | 101–200 | 50–99 |
| Elite | 201–317 | 99+ |
`;
}
