import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export interface BotCredentials {
  charname: string;
  charfilePath: string;
  accountName: string;
  accountHash: string;
}

export interface ProvisionerConfig {
  /** Path to ao-libre server Charfile/ directory */
  charfileDir: string;
  /** Path to ao-libre server Account/ directory (defaults to ../Account relative to charfileDir) */
  accountDir?: string;
  /** Starting map */
  map?: number;
  /** Starting X */
  x?: number;
  /** Starting Y */
  y?: number;
  /**
   * Account name to use. If provided, the charname is added to this account
   * (up to 10 chars per account). If omitted, a dedicated account is created
   * matching the charname.
   */
  accountName?: string;
}

interface CharfileOpts {
  map: number;
  x: number;
  y: number;
  accountHash: string;
}

// ── File content builders ──────────────────────────────────────────────────

/**
 * Build the full INI content for a bot charfile.
 * Uses \r\n line endings (Windows INI format).
 */
export function buildCharfile(charname: string, opts: CharfileOpts): string {
  const { map, x, y, accountHash } = opts;

  const lines: string[] = [
    "[INIT]",
    `AccountHash=${accountHash}`,
    "Genero=1",
    "Raza=1",
    "Hogar=1",
    "Clase=3",
    "Desc=Bot character",
    "Heading=3",
    "Head=3",
    "Body=1",
    "Arma=0",
    "Escudo=0",
    "Casco=0",
    `Position=${map}-${x}-${y}`,
    "Logged=0",
    "",
    "[FLAGS]",
    "Muerto=0",
    "Escondido=0",
    "Hambre=0",
    "Sed=0",
    "Desnudo=0",
    "Ban=0",
    "Navegando=0",
    "Envenenado=0",
    "Paralizado=0",
    `LastMap=${map}`,
    "",
    "[STATS]",
    "GLD=500",
    "BANCO=0",
    "MaxHP=100",
    "MinHP=100",
    "MaxSTA=100",
    "MinSTA=100",
    "MaxMAN=80",
    "MinMAN=80",
    "MaxHIT=10",
    "MinHIT=5",
    "MaxAGU=50",
    "MinAGU=50",
    "MaxHAM=50",
    "MinHAM=50",
    "SkillPtsLibres=255",
    "EXP=0",
    "ELV=1",
    "ELU=0",
    "",
    "[SKILLS]",
    ...Array.from({ length: 21 }, (_, i) => `SK${i + 1}=0`),
    ...Array.from({ length: 21 }, (_, i) => `ELUSK${i + 1}=0`),
    ...Array.from({ length: 21 }, (_, i) => `EXPSK${i + 1}=0`),
    "",
    "[CONTACTO]",
    "Email=bot@aobench.local",
    "",
    "[MUERTES]",
    "UserMuertes=0",
    "NpcsMuertes=0",
    "",
    "[FACCIONES]",
    "EjercitoReal=0",
    "EjercitoCaos=0",
    "CiudMatados=0",
    "CrimMatados=0",
    "NivelIngreso=0",
    "FechaIngreso=",
    "MatadosIngreso=0",
    "NextRecompensa=0",
    "",
    "[COUNTERS]",
    "Pena=0",
    "SkillsAsignados=0",
    "",
    "[CONSEJO]",
    "PERTENECE=0",
    "PERTENECECAOS=0",
    "",
  ];

  return lines.join("\r\n");
}

/**
 * Build the .acc file content for an account.
 * Password is a dummy hash (bots don't login via password — they're
 * provisioned directly into UserList by the server).
 */
export function buildAccFile(accountHash: string): string {
  const now = new Date().toLocaleDateString("es-AR");
  const lines = [
    "[INIT]",
    "Password=aobench_bot",
    "Salt=aobench",
    `Hash=${accountHash}`,
    `FechaCreado=${now}`,
    "",
  ];
  return lines.join("\r\n");
}

/**
 * Build the .ach file content (account-to-characters mapping).
 * charnames: array of charnames belonging to this account (max 10).
 */
export function buildAchFile(accountName: string, charnames: string[]): string {
  if (charnames.length > 10) {
    throw new Error(`Account ${accountName} already has 10 characters (maximum)`);
  }
  const lines = [
    "[INIT]",
    `UserName=${accountName.toUpperCase()}`,
    `CantidadPersonajes=${charnames.length}`,
    "",
    "[PERSONAJES]",
    ...charnames.map((n, i) => `Personaje${i + 1}=${n.toUpperCase()}`),
    "",
  ];
  return lines.join("\r\n");
}

// ── INI parser (minimal — reads Key=Value within sections) ─────────────────

function parseIniSection(content: string, section: string): Record<string, string> {
  const result: Record<string, string> = {};
  const normalized = content.replace(/\r\n/g, "\n");
  const sectionRe = new RegExp(`\\[${section}\\]([^\\[]*)`, "i");
  const match = sectionRe.exec(normalized);
  if (!match) return result;
  for (const line of (match[1] ?? "").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) {
      result[line.slice(0, eq).trim().toLowerCase()] = line.slice(eq + 1).trim();
    }
  }
  return result;
}

// ── Account hash derivation ────────────────────────────────────────────────

/**
 * Derive the account hash from the account name.
 * ao-libre uses a SHA-256 of the account name as the hash that links
 * the .acc file to the .ach file and to each .chr charfile.
 */
export function deriveAccountHash(accountName: string): string {
  return createHash("sha256").update(accountName.toUpperCase()).digest("hex").slice(0, 32);
}

// ── Core provisioning ──────────────────────────────────────────────────────

/** Resolve the uppercase .chr filename for a given charname. */
function charfileName(charname: string): string {
  return `${charname.toUpperCase()}.chr`;
}

function resolveAccountDir(config: ProvisionerConfig): string {
  return config.accountDir ?? path.join(config.charfileDir, "..", "Account");
}

/**
 * Create a bot charfile + account files in the ao-libre directories.
 *
 * Account strategy:
 * - If accountName is provided in config, add the charname to that account
 *   (reuses existing .acc/.ach, creates them if absent, max 10 chars).
 * - If accountName is omitted, create a dedicated account named after the
 *   charname (1 char per account — simplest for independent benchmark runs).
 *
 * Returns full credentials including account info.
 */
export function provisionBot(
  charname: string,
  config: ProvisionerConfig,
): BotCredentials {
  const map = config.map ?? 1;
  const x = config.x ?? 50;
  const y = config.y ?? 50;
  const accountName = config.accountName ?? charname;
  const accountHash = deriveAccountHash(accountName);

  const accountDir = resolveAccountDir(config);
  fs.mkdirSync(config.charfileDir, { recursive: true });
  fs.mkdirSync(accountDir, { recursive: true });

  // ── Write charfile ──────────────────────────────────────────────────────
  const content = buildCharfile(charname, { map, x, y, accountHash });
  const charfilePath = path.join(config.charfileDir, charfileName(charname));
  fs.writeFileSync(charfilePath, content, { encoding: "utf-8" });

  // ── Write .acc file (account credentials) ──────────────────────────────
  const accPath = path.join(accountDir, `${accountName.toUpperCase()}.acc`);
  if (!fs.existsSync(accPath)) {
    fs.writeFileSync(accPath, buildAccFile(accountHash), { encoding: "utf-8" });
  }

  // ── Write/update .ach file (account-character mapping) ─────────────────
  const achPath = path.join(accountDir, `${accountHash}.ach`);
  let existingChars: string[] = [];

  if (fs.existsSync(achPath)) {
    const existing = fs.readFileSync(achPath, { encoding: "utf-8" });
    const init = parseIniSection(existing, "INIT");
    const count = parseInt(init["cantidadpersonajes"] ?? "0", 10);
    const personajes = parseIniSection(existing, "PERSONAJES");
    for (let i = 1; i <= count; i++) {
      const name = personajes[`personaje${i}`];
      if (name && name.toUpperCase() !== charname.toUpperCase()) {
        existingChars.push(name);
      }
    }
  }

  // Add new charname if not already present (and under limit)
  existingChars.push(charname.toUpperCase());
  if (existingChars.length > 10) {
    throw new Error(
      `Account ${accountName} already has 10 characters (maximum). ` +
      `Use a different accountName or deprovision an existing bot first.`
    );
  }

  fs.writeFileSync(achPath, buildAchFile(accountName, existingChars), { encoding: "utf-8" });

  return { charname, charfilePath, accountName, accountHash };
}

/**
 * Delete a bot charfile and remove it from the account's .ach file.
 * Does NOT delete the .acc file — other characters may share the account.
 * No-op if files do not exist.
 */
export function deprovisionBot(
  charname: string,
  config: ProvisionerConfig,
): void {
  const accountName = config.accountName ?? charname;
  const accountHash = deriveAccountHash(accountName);
  const accountDir = resolveAccountDir(config);

  // Remove charfile
  const charfilePath = path.join(config.charfileDir, charfileName(charname));
  try {
    fs.unlinkSync(charfilePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  // Remove from .ach
  const achPath = path.join(accountDir, `${accountHash}.ach`);
  if (fs.existsSync(achPath)) {
    const existing = fs.readFileSync(achPath, { encoding: "utf-8" });
    const init = parseIniSection(existing, "INIT");
    const count = parseInt(init["cantidadpersonajes"] ?? "0", 10);
    const personajes = parseIniSection(existing, "PERSONAJES");
    const remaining: string[] = [];
    for (let i = 1; i <= count; i++) {
      const name = personajes[`personaje${i}`];
      if (name && name.toUpperCase() !== charname.toUpperCase()) {
        remaining.push(name);
      }
    }
    if (remaining.length === 0) {
      // No more characters — delete .ach (and optionally .acc)
      fs.unlinkSync(achPath);
      const accPath = path.join(accountDir, `${accountName.toUpperCase()}.acc`);
      try { fs.unlinkSync(accPath); } catch { /* ignore */ }
    } else {
      fs.writeFileSync(achPath, buildAchFile(accountName, remaining), { encoding: "utf-8" });
    }
  }
}

/**
 * Check if a charfile already exists for this name.
 */
export function botExists(
  charname: string,
  config: ProvisionerConfig,
): boolean {
  return fs.existsSync(path.join(config.charfileDir, charfileName(charname)));
}

/**
 * List all charnames registered to an account.
 */
export function listAccountBots(
  accountName: string,
  config: ProvisionerConfig,
): string[] {
  const accountHash = deriveAccountHash(accountName);
  const accountDir = resolveAccountDir(config);
  const achPath = path.join(accountDir, `${accountHash}.ach`);
  if (!fs.existsSync(achPath)) return [];

  const content = fs.readFileSync(achPath, { encoding: "utf-8" });
  const init = parseIniSection(content, "INIT");
  const count = parseInt(init["cantidadpersonajes"] ?? "0", 10);
  const personajes = parseIniSection(content, "PERSONAJES");
  const result: string[] = [];
  for (let i = 1; i <= count; i++) {
    const name = personajes[`personaje${i}`];
    if (name) result.push(name);
  }
  return result;
}
