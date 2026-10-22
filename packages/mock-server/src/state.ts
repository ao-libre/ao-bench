import type {
  WorldState,
  NearbyNpc,
  Skills,
  SkillName,
  InventorySlot,
  StatusEffect,
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
  /** Charnames of party members. */
  partyMembers: string[];
  /** Whether an NPC commerce window is open. */
  isInCommerce: boolean;
  /** Whether the bank window is open. */
  isInBank: boolean;
  /** Whether a player-to-player trade is active. */
  isInUserCommerce: boolean;
  /** Items offered in the current player trade. */
  commerceOffer: InventorySlot[];
  /** Bank inventory slots. */
  bank: InventorySlot[];
  /** Status effects (mirrors world.statusEffects for convenience). */
  statusEffects: StatusEffect[];
  /** Whether the bot has GM privileges. */
  isGM: boolean;
  /** NPCs spawned by gmSpawn. */
  spawnedNpcs: NearbyNpc[];
  /** Friends list. */
  amigos: string[];
  /** Currently active quest (mock single-quest tracking). */
  activeQuest: { questId: number; name: string; slot: number; npcProgress: { npcId: number; required: number; killed: number }[]; rewardXp: number; rewardGold: number; requiredLevel: number } | null;
}

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
    expNeeded: 1000,
    level: 1,
    clase: 3, // Guerrero
    skills: makeSkills(),
    skillPts: 10,
    assignedSkills: 0,
    attributes: { Fuerza: 18, Agilidad: 14, Inteligencia: 10, Carisma: 12, Constitucion: 16 },
    inventory: [
      { slot: 1, itemId: 21, name: "Espada de Hierro", amount: 1, equipped: true },
      { slot: 2, itemId: 51, name: "Pocion de Vida", amount: 5, equipped: false },
    ],
    spells: Array.from({ length: 35 }, (_, i) => i === 0 ? { slot: 1, spellId: 1, name: "Dardo Magico", minSkill: 0, manaCost: 10 } : null),
    bank: [],
    bankGold: 1000,
    nearbyNpcs: [
      { id: 1, name: "Goblin", x: 51, y: 50, hp: 80, maxHp: 80, type: 5 },
      { id: 2, name: "Mercader", x: 53, y: 50, hp: 100, maxHp: 100, type: 0 },
    ],
    nearbyPlayers: [],
    statusEffects: [],
    faction: "none",
    reputation: { npcKills: 0, playerKills: 0, citizensKilled: 0, criminalsKilled: 0 },
    party: null,
    quests: { active: [], doneIds: [] },
    timestamp: Date.now(),
  };
  return {
    world,
    npcHp: 80,
    pendingXp: 0,
    partyMembers: [],
    isInCommerce: false,
    isInBank: false,
    isInUserCommerce: false,
    commerceOffer: [],
    bank: [{ slot: 1, itemId: 100, name: "Oro en banco", amount: 1000, equipped: false }],
    statusEffects: [],
    isGM: false,
    spawnedNpcs: [],
    amigos: [],
    activeQuest: null,
  };
}
