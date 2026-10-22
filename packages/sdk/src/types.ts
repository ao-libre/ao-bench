// ─────────────────────────────────────────────────────────────────────────────
// ao-libre types — exactly 20 skills, 4 headings
// ─────────────────────────────────────────────────────────────────────────────

/** The 20 skills in ao-libre (eSkill enum, 1-based). */
export type SkillName =
  | "Magia"
  | "Robar"
  | "Tacticas"
  | "Armas"
  | "Meditar"
  | "Apuñalar"
  | "Ocultarse"
  | "Supervivencia"
  | "Talar"
  | "Comerciar"
  | "Defensa"
  | "Pesca"
  | "Minería"
  | "Carpintería"
  | "Herrería"
  | "Liderazgo"
  | "Domar"
  | "Proyectiles"
  | "Wrestling"
  | "Navegación";

export const ALL_SKILLS: readonly SkillName[] = [
  "Magia",
  "Robar",
  "Tacticas",
  "Armas",
  "Meditar",
  "Apuñalar",
  "Ocultarse",
  "Supervivencia",
  "Talar",
  "Comerciar",
  "Defensa",
  "Pesca",
  "Minería",
  "Carpintería",
  "Herrería",
  "Liderazgo",
  "Domar",
  "Proyectiles",
  "Wrestling",
  "Navegación",
] as const;

/** ao-libre only has 4 cardinal directions (E_Heading). */
export type Heading = "north" | "south" | "east" | "west";

export type Skills = Record<SkillName, SkillValue>;

export interface SkillValue {
  /** Current skill level (0-100). */
  level: number;
  /** Experience points within the current level. */
  exp: number;
}

export interface Position {
  x: number;
  y: number;
  /** Map number. */
  map: number;
}

export interface InventorySlot {
  /** 1-based slot index. */
  slot: number;
  /** Item ID (from ao-libre item DAT). */
  itemId: number;
  name: string;
  amount: number;
  equipped: boolean;
}

export interface NearbyNpc {
  /** UserList index or NPC unique ID. */
  id: number;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** NPC class/type ID. */
  type: number;
}

export interface NearbyPlayer {
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export type StatusEffect = "poisoned" | "bleeding" | "paralyzed" | "frozen" | "stunned";

export interface SpellSlot {
  slot: number;
  spellId: number;
  name: string;
  minSkill: number;
  manaCost: number;
}

export interface QuestProgress {
  slot: number;
  questId: number;
  name: string;
  requiredLevel: number;
  npcProgress: { npcId: number; required: number; killed: number }[];
  rewardXp: number;
  rewardGold: number;
}

export interface WorldState {
  charname: string;
  pos: Position;
  heading: Heading;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  stamina: number;
  maxStamina: number;
  gold: number;
  exp: number;
  expNeeded: number;
  level: number;
  /** Character class ID. */
  clase: number;
  skills: Skills;
  skillPts: number;
  assignedSkills: number;
  attributes: { Fuerza: number; Agilidad: number; Inteligencia: number; Carisma: number; Constitucion: number };
  inventory: InventorySlot[];
  spells: (SpellSlot | null)[];
  bank: InventorySlot[];
  bankGold: number;
  nearbyNpcs: NearbyNpc[];
  nearbyPlayers: NearbyPlayer[];
  statusEffects: StatusEffect[];
  faction: "none" | "real" | "caos";
  reputation: { npcKills: number; playerKills: number; citizensKilled: number; criminalsKilled: number };
  party: { index: number; isLeader: boolean; members: string[] } | null;
  quests: { active: QuestProgress[]; doneIds: number[] };
  /** Server timestamp in ms. */
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// BotAPI wire protocol types (shared by mock-server and gateway)
// ─────────────────────────────────────────────────────────────────────────────

export interface BotApiRequest {
  action: string;
  charname: string;
  [key: string]: unknown;
}

export interface BotApiOkResponse {
  ok: true;
  [key: string]: unknown;
}

export interface BotApiErrorResponse {
  ok: false;
  error: string;
}

export type BotApiResponse = BotApiOkResponse | BotApiErrorResponse;

export interface BotApiStateResponse extends BotApiOkResponse {
  state: WorldState;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gateway WebSocket protocol
// ─────────────────────────────────────────────────────────────────────────────

/** Sent by SDK client to connect as controller or observer. */
export interface GatewayConnectMsg {
  type: "sdk_connect";
  charname: string;
  password: string;
  mode: "control" | "observe";
}

/** Sent by SDK client to execute an action. */
export interface GatewayActionMsg {
  type: "sdk_action";
  action: string;
  charname: string;
  [key: string]: unknown;
}

/** Sent by gateway to SDK — state update. */
export interface GatewayStateMsg {
  type: "state";
  state: WorldState;
}

/** Sent by gateway to SDK — action result. */
export interface GatewayResultMsg {
  type: "result";
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/** Sent by gateway to SDK — session established. */
export interface GatewayConnectedMsg {
  type: "connected";
  charname: string;
  mode: "control" | "observe";
}

/** Sent by gateway to SDK — error or pre-emption. */
export interface GatewayErrorMsg {
  type: "error";
  error: string;
  code?: "preempted" | "unauthorized" | "not_found" | "internal";
}

export type GatewayServerMsg =
  | GatewayStateMsg
  | GatewayResultMsg
  | GatewayConnectedMsg
  | GatewayErrorMsg;

export type GatewayClientMsg = GatewayConnectMsg | GatewayActionMsg;
