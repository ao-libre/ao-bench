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

ao-libre has 20 skills (eSkill enum, IDs 1–20).
Skill ID 21 (Equitacion) exists in the enum but is unused in v1.

## How skills work

- Each skill has a **level** (0–100) and **exp** within the current level.
- Gaining enough exp increases the level.
- The benchmark measures raw **exp points gained** — not level increases.
- Skills only gain exp when you actively use them — idle time gives nothing.

## Skill table

| ID | Skill name | How to gain XP |
|----|-----------|----------------|
| 1 | Magia | Cast any spell (castSpell, useSpellMacro) |
| 2 | Robar | Use steal skill (useSkill("Robar")) on a player or NPC |
| 3 | Tacticas | Win melee combat (attack and kill NPCs) |
| 4 | Armas | Hit NPCs or players with a weapon (attack) |
| 5 | Meditar | Toggle meditate() while mana < max — gains exp while meditating |
| 6 | Apunalar | Stab attacks (Assassin/Thief class) |
| 7 | Ocultarse | Use useSkill("Ocultarse") to hide |
| 8 | Supervivencia | Take damage and survive — passive, gained in combat |
| 9 | Talar | Use workLeftClick(x,y) on a tree tile (type 4 in items = Arboles) |
| 10 | Comerciar | Buy or sell items at NPC merchants |
| 11 | Defensa | Take hits in combat — passive, gained while being attacked |
| 12 | pesca | Use useSkill("pesca") near a water tile |
| 13 | Mineria | Use workLeftClick(x,y) on an ore deposit (type 22 = Yacimiento) |
| 14 | Carpinteria | Use craftCarpenter(itemId) at a carpenter bench |
| 15 | Herreria | Use craftBlacksmith(itemId) at a forge |
| 16 | Liderazgo | Lead a party in combat (partyCreate first) |
| 17 | Domar | Use useSkill("Domar") on a tameable creature |
| 18 | Proyectiles | Attack with a bow (equip bow + arrows first) |
| 19 | Wrestling | Unarmed combat (no weapon equipped) |
| 20 | Navegacion | Navigate on a boat (Mod_Barcos) |

## Important: skill names in the SDK

Use the exact skill names from the ID column above when calling useSkill():
- useSkill("pesca")        ← lowercase p, exact spelling
- useSkill("Tacticas")     ← no accent
- useSkill("Apunalar")     ← no tilde on n
- useSkill("Mineria")      ← no accent
- useSkill("Carpinteria")  ← no accent
- useSkill("Herreria")     ← no accent
- useSkill("Navegacion")   ← no accent

# Game Mechanics Guide

Essential rules every agent must know.

## Combat and XP

- **Killing NPCs gives XP** to Tacticas, Armas, and Defensa (all at once).
- **Casting spells on NPCs gives Magia XP** — even if the spell doesn't kill.
- **XP amount scales with NPC difficulty** — weak NPCs (Gallo, Rata) give 5–20 XP;
  strong NPCs (Oso Polar, Tigre) give 500–6000 XP.
- **You must be in range** to attack — roughly 1–3 tiles from the NPC.
- **Combat interval** — the server enforces a minimum time between hits
  (~1500ms for melee). Sending attack faster does not help; wait 1–2 ticks.
- **Hostile NPCs** (Hostile=Yes in the NPC table) will attack you automatically
  when nearby. Non-hostile NPCs (Hostile=No) only fight back if attacked.

## Death and resurrection

- When HP reaches 0 you are **dead** (statusEffects includes "dead").
- **While dead** you cannot move, attack, or cast spells.
- To resurrect you must reach a **Sacerdote (Resucitador NPC, type 1)**:
  - Walk your dead character to the Sacerdote's location.
  - Call resucitate() — the NPC resurrects you.
  - You respawn with partial HP — heal before fighting again.
- Alternatively: wait for another player to cast Resucitar spell (slot 11).
- **Key Sacerdote locations (map 1):**
  - NPC 5 and NPC 119 are Sacerdotes in Banderbill starting area.

## HP, Mana, and Stamina regeneration

- **HP regenerates slowly** while resting (rest()) — toggle on, wait ticks, toggle off.
- **Mana regenerates** while meditating (meditate()) — stand still, toggle on,
  wait until mana recovers, toggle off. Movement cancels meditation.
- **Stamina** is used by physical actions and spells. Regenerates over time.
- **Pociones de Vida** (HP potions, item in slot 2 of default loadout) instantly
  restore ~30 HP — use useItem(2) when HP is low.

## Inventory management

- Inventory has 35 slots (1-based). Default loadout:
  - Slot 1: Espada de Hierro (equipped weapon)
  - Slot 2: Pocion de Vida ×5 (HP potions)
- Items on the ground can be picked up with pickUp(x, y).
- Drop items with drop(slot, amount) to free inventory space.
- Check inventory with getState().inventory.

## Spells and mana

- Spells are assigned to hotbar slots 1–35. Default bots start with some spells.
- Check getState().skills["Magia"].level — you need MinSkill to cast each spell.
- Slot 1 is typically Antídoto Mágico (min skill 10, 12 mana) — not an attack spell.
- Slot 2 is typically Dardo Mágico (min skill 6, 10 mana) — basic attack spell.
- **For Magia XP: use an offensive spell (Dardo Mágico, Flecha Mágica) on NPCs.**
- Mana cost varies: Dardo Mágico=10, Flecha Mágica=20, Paralizar=450.
- If Magia skill is 0 and MinSkill>0, the spell fails — use a low-requirement spell.

## Status effects

| Effect | What it means | How to cure |
|--------|--------------|-------------|
| poisoned | Losing HP over time | Cast Antídoto Mágico (spell 1) or wait |
| paralyzed | Cannot move | Wait for it to expire or cast Devolver Movilidad |
| blind | Reduced vision | Wait for it to expire |
| dumb | Cannot cast spells | Wait for it to expire |
| meditating | Regenerating mana | Call meditate() again to toggle off before acting |
| resting | Regenerating HP | Call rest() again to toggle off before acting |
| dead | Character is dead | Walk to Sacerdote and call resucitate() |

## Starting position (Map 1, Banderbill)

Default bot spawn: map 1, x=50, y=50.
- Nearby beginner NPCs: Gallo (15 HP, 10 XP), Rata (15 HP, 5 XP),
  Cerdo (35 HP, 15 XP), Conejo (15 HP, 10 XP)
- Sacerdote (resurrection): NPC 5 and NPC 119 in Banderbill
- Banker: NPC 24
- The main city area is around x=40–60, y=40–60 on map 1
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
