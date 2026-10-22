# Classes and Attributes

Sourced from the ao-libre community wiki (v0.13.x).

---

## Classes

Every character has a class that determines their strengths, which skills they
excel at, and whether they have mana. Bots default to **class 3 (Guerrero)**
unless the provisioner is configured otherwise.

| ID | Class | Has Mana | Strengths |
|----|-------|----------|-----------|
| 1  | Mago (Mage) | Yes | Pure magic user — weakest physical fighter, lowest agility. Best for Magia XP. |
| 2  | Clérigo (Cleric) | Yes | Mix of magic and physical combat, no standout specialty. |
| 3  | Guerrero (Warrior) | No | Expert with melee and ranged weapons. Best for Armas, Defensa, Tacticas XP. |
| 4  | Asesino (Assassin) | Yes | Expert in Apuñalar, with strong physical and magic attack. |
| 5  | Ladrón (Thief) | No | Expert in Robar. Can steal from 2 tiles away. Also skilled with boats. |
| 6  | Bardo (Bard) | Yes | Similar to Clérigo but more magic-oriented. |
| 7  | Druida (Druid) | Yes | Expert in Domar (taming). |
| 8  | Bandido (Bandit) | Yes | Average physical and magic attack, no standout specialty. |
| 9  | Paladín (Paladin) | Yes (from level 2) | Expert with weapons and armor. Very strong physical attack, good magic. |
| 10 | Cazador (Hunter) | No | Expert with Proyectiles (bows and arrows). |
| 11 | Trabajador (Worker) | No | Expert in all crafting/gathering: Carpintería, Herrería, Minería, Pesca, Tala. |
| 12 | Pirata (Pirate) | No | Expert in Navegación (boats). |

### Key implications for agents

- **No mana classes** (Guerrero, Ladrón, Cazador, Trabajador, Pirata): `getState().mana`
  will always be 0 and `maxMana` will be 0. Do not call `meditate()` or `castSpell()`
  — neither will work. Focus entirely on physical skills.
- **Mana classes** (Mago, Clérigo, Asesino, Bardo, Druida, Bandido, Paladín):
  can cast spells and gain Magia XP. Must manage mana with `meditate()`.
- **Check your class** at the start of every script:
  ```ts
  const s = bot.getState();
  const hasMana = s.maxMana > 0;
  ```

---

## Attributes

Attributes (called "dados" — dice) are generated randomly when creating a
character. They determine the character's core stats. Higher values mean a
stronger character; lower values mean a weaker one.

| Attribute | What it does |
|-----------|-------------|
| **Fuerza** (Strength) | Physical power. Directly affects melee damage dealt. Can be boosted by the spell "Fuerza" or green potions (Pociones Verdes), up to double the base value, but never above 40. |
| **Agilidad** (Agility) | Dexterity and reflexes. Affects melee and ranged combat — determines hit chance and dodge chance. Can be boosted by spell "Celeridad" or yellow potions (Pociones Amarillas), up to double, never above 40. |
| **Inteligencia** (Intelligence) | Determines max mana and mana gained per level up. Irrelevant for no-mana classes. |
| **Carisma** (Charisma) | Used for taming animals (Domar skill). |
| **Constitución** (Constitution) | Determines max HP and HP gained per level up. |

### Buff indicators

When Fuerza or Agilidad are boosted by a potion or spell, the client shows a
visual warning a few seconds before the buff expires. When the buff expires, the
attribute returns to its natural value. This is cosmetic from the bot's perspective
— the bot does not see attribute values directly, only their effects through
combat outcomes (HP lost/dealt) and skill XP gains.

### Practical implications for agents

- A bot with high **Constitución** has more HP — can fight longer before needing
  to rest or retreat.
- A bot with high **Inteligencia** has more mana — can cast more spells before
  needing to meditate.
- A bot with high **Agilidad** hits more reliably and dodges more — better for
  Armas XP farming since you land more hits.
- A bot with high **Fuerza** deals more damage per hit — kills NPCs faster,
  meaning higher Tacticas XP rate.
- Attributes are fixed at character creation and visible in the game UI, but
  **not exposed in WorldState**. Treat them as fixed background bonuses that
  affect combat efficiency without directly being readable.
