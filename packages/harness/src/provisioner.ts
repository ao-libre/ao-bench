import fs from "node:fs";
import path from "node:path";

export interface BotCredentials {
  charname: string;
  charfilePath: string;
}

export interface ProvisionerConfig {
  /** Path to ao-libre server Charfile/ directory */
  charfileDir: string;
  /** Starting map */
  map?: number;
  /** Starting X */
  x?: number;
  /** Starting Y */
  y?: number;
}

interface CharfileOpts {
  map: number;
  x: number;
  y: number;
}

/**
 * Build the full INI content for a bot charfile.
 * Uses \r\n line endings (Windows INI format).
 */
export function buildCharfile(charname: string, opts: CharfileOpts): string {
  const map = opts.map;
  const x = opts.x;
  const y = opts.y;

  const lines: string[] = [
    "[INIT]",
    "AccountHash=",
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
    "SK1=0",
    "SK2=0",
    "SK3=0",
    "SK4=0",
    "SK5=0",
    "SK6=0",
    "SK7=0",
    "SK8=0",
    "SK9=0",
    "SK10=0",
    "SK11=0",
    "SK12=0",
    "SK13=0",
    "SK14=0",
    "SK15=0",
    "SK16=0",
    "SK17=0",
    "SK18=0",
    "SK19=0",
    "SK20=0",
    "SK21=0",
    "ELUSK1=0",
    "ELUSK2=0",
    "ELUSK3=0",
    "ELUSK4=0",
    "ELUSK5=0",
    "ELUSK6=0",
    "ELUSK7=0",
    "ELUSK8=0",
    "ELUSK9=0",
    "ELUSK10=0",
    "ELUSK11=0",
    "ELUSK12=0",
    "ELUSK13=0",
    "ELUSK14=0",
    "ELUSK15=0",
    "ELUSK16=0",
    "ELUSK17=0",
    "ELUSK18=0",
    "ELUSK19=0",
    "ELUSK20=0",
    "ELUSK21=0",
    "EXPSK1=0",
    "EXPSK2=0",
    "EXPSK3=0",
    "EXPSK4=0",
    "EXPSK5=0",
    "EXPSK6=0",
    "EXPSK7=0",
    "EXPSK8=0",
    "EXPSK9=0",
    "EXPSK10=0",
    "EXPSK11=0",
    "EXPSK12=0",
    "EXPSK13=0",
    "EXPSK14=0",
    "EXPSK15=0",
    "EXPSK16=0",
    "EXPSK17=0",
    "EXPSK18=0",
    "EXPSK19=0",
    "EXPSK20=0",
    "EXPSK21=0",
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

/** Resolve the uppercase .chr filename for a given charname. */
function charfileName(charname: string): string {
  return `${charname.toUpperCase()}.chr`;
}

/**
 * Create a bot charfile in the ao-libre Charfile/ directory.
 * Returns credentials. The server hot-loads charfiles so the character
 * is available immediately without a restart.
 * Overwrites any existing file for this charname.
 */
export function provisionBot(
  charname: string,
  config: ProvisionerConfig,
): BotCredentials {
  const map = config.map ?? 1;
  const x = config.x ?? 50;
  const y = config.y ?? 50;

  const content = buildCharfile(charname, { map, x, y });
  const filename = charfileName(charname);
  const charfilePath = path.join(config.charfileDir, filename);

  fs.mkdirSync(config.charfileDir, { recursive: true });
  fs.writeFileSync(charfilePath, content, { encoding: "utf-8" });

  return { charname, charfilePath };
}

/**
 * Delete a bot charfile (cleanup after run).
 * No-op if the file does not exist.
 */
export function deprovisionBot(
  charname: string,
  config: ProvisionerConfig,
): void {
  const filename = charfileName(charname);
  const charfilePath = path.join(config.charfileDir, filename);
  try {
    fs.unlinkSync(charfilePath);
  } catch (err) {
    // Ignore ENOENT — already gone
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
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
  const filename = charfileName(charname);
  const charfilePath = path.join(config.charfileDir, filename);
  return fs.existsSync(charfilePath);
}
