import type {
  WorldState,
  NearbyNpc,
  Skills,
  SkillName,
  ALL_SKILLS,
} from "../../sdk/src/types.js";

// Re-export from sdk types to avoid circular dep issues — copy the array locally.
const SKILLS: readonly SkillName[] = [
  "Magia", "Robar", "Tacticas", "Armas", "Meditar",
  "Apuñalar", "Ocultarse", "Supervivencia", "Talar", "Comerciar",
  "Defensa", "Pesca", "Minería", "Carpintería", "Herrería",
  "Liderazgo", "Domar", "Proyectiles", "Wrestling", "Navegación",
] as const;

function makeSkills(): Skills {
  const s = {} as Skills;
  for (const sk of SKILLS) {
    s[sk] = { level: 0, exp: 0 };
  }
  return s;
}

export interface BotState {
  world: WorldState;
  /** Simulated NPC HP — mutated on attack. */
  npcHp: number;
  /** Accumulated XP gains to apply. */
  pendingXp: number;
}

const MOCK_NPC: NearbyNpc = {
  id: 1,
  name: "Goblin",
  x: 51,
  y: 50,
  hp: 80,
  maxHp: 80,
  type: 5,
};

export function makeDefaultState(charname: string): BotState {
  const world: WorldState = {
    charname,
    pos: { x: 50, y: 50, map: 1 },
    heading: "south",
    hp: 100,
    maxHp: 100,
    mana: 80,
    maxMana: 80,
    stamina: 100,
    maxStamina: 100,
    gold: 500,
    exp: 0,
    level: 1,
    clase: 3, // Guerrero
    skills: makeSkills(),
    inventory: [
      { slot: 1, itemId: 21, name: "Espada de Hierro", amount: 1, equipped: true },
      { slot: 2, itemId: 51, name: "Pocion de Vida", amount: 5, equipped: false },
    ],
    nearbyNpcs: [{ ...MOCK_NPC }],
    nearbyPlayers: [],
    statusEffects: [],
    timestamp: Date.now(),
  };
  return { world, npcHp: MOCK_NPC.maxHp, pendingXp: 0 };
}
