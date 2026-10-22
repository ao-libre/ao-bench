# Skills Guide

ao-libre has 20 skills (eSkill enum, IDs 1–20).
Skill ID 21 (Equitacion) exists in the enum but is unused in v1.

## How skills work

- Each skill has a **level** (0–100) and **exp** within the current level.
- Gaining enough exp increases the level.
- The benchmark measures raw **exp points gained** — not level increases.
- Skills only gain exp when you actively use them — idle time gives nothing.

## Skill points and natural training

**New characters start with 10 free skill points** to assign however they like.

**Critical rule: you must assign all 10 initial skill points before any natural
skill training is possible.** The server checks `AsignedSkills < 10` at the
start of `SubirSkill` and silently does nothing if the condition is true. If you
try to train a skill before assigning those 10 points, no XP is gained.

Call `assignSkillPoints(distribution)` via the SDK to spend them. Example:
```js
// Distribute all 10 points across skills before doing anything else
await sdk.assignSkillPoints({ Armas: 5, Defensa: 3, Tacticas: 2 });
```

**Per-level natural cap.** Even after assigning, each skill has a maximum value
it can reach naturally at your current level. The cap comes from `LevelSkill[]`
in General.bas:

| Character level | Natural skill cap |
|----------------|-------------------|
| 1  | 3  |
| 2  | 5  |
| 4  | 10 |
| 8  | 20 |
| 10 | 25 |
| 20 | 50 |
| 30 | 75 |
| 40 | 100 |

(Intermediate levels scale proportionally — full table in General.bas.)

If a skill is **at or above** the cap for your level, `SubirSkill` exits early
and no XP is added. You must level up first to raise the cap.

**Assigned points count against the cap.** If you assign 5 points to Armas at
level 1 (cap = 3), Armas is already above the cap and cannot gain natural XP
until you reach a higher level. Assign conservatively if you want to also train
skills naturally while levelling up.

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
