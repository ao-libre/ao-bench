#!/usr/bin/env node
/**
 * wiki-extractor CLI
 * Reads ao-libre DAT files and writes Markdown wiki pages.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  extractItems,
  extractMaps,
  extractNpcs,
  extractSkills,
  extractSpells,
} from "./extractors.js";

// ─── Usage ────────────────────────────────────────────────────────────────────

const USAGE = `\
wiki-extractor — ao-libre DAT file to markdown extractor

Usage:
  wiki-extractor --dat-dir <path> [options]

Options:
  --dat-dir <path>  Path to ao-libre Dat/ directory (required)
  --out-dir <path>  Output directory (default: ./wiki)
  -h, --help        Show this help

Outputs:
  <out-dir>/items.md    Item database (obj.dat)
  <out-dir>/npcs.md     NPC database (NPCs.dat)
  <out-dir>/spells.md   Spell database (Hechizos.dat)
  <out-dir>/skills.md   Skills guide (20 ao-libre skills, static)
  <out-dir>/maps.md     Map zones guide (static)`;

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function nextArg(args: string[], i: number, flag: string): string {
  const val = args[i];
  if (val === undefined) {
    process.stderr.write(`[wiki-extractor] Missing value for ${flag}\n`);
    process.exit(1);
  }
  return val;
}

function parseArgs(argv: string[]): {
  help: boolean;
  datDir: string | undefined;
  outDir: string;
} {
  const args = argv.slice(2);
  let help = false;
  let datDir: string | undefined;
  let outDir = "./wiki";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--dat-dir") {
      datDir = nextArg(args, ++i, "--dat-dir");
    } else if (arg === "--out-dir") {
      outDir = nextArg(args, ++i, "--out-dir");
    } else if (arg !== undefined) {
      process.stderr.write(`[wiki-extractor] Unknown argument: ${arg}\n`);
      process.exit(1);
    }
  }

  return { help, datDir, outDir };
}

// ─── Count helpers ────────────────────────────────────────────────────────────

/** Count the table rows in a markdown string (non-header, non-separator lines that start with |). */
function countRows(md: string): number {
  const lines = md.split("\n");
  // Skip the heading, blank line, header row, and separator row
  let headersSeen = 0;
  let count = 0;
  for (const line of lines) {
    if (!line.startsWith("|")) continue;
    // The separator row contains only |, -, and spaces
    if (/^\|[\s\-|]+\|$/.test(line)) continue;
    headersSeen++;
    if (headersSeen === 1) continue; // skip the column-name row
    count++;
  }
  return count;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv);

if (opts.help) {
  process.stdout.write(USAGE + "\n");
  process.exit(0);
}

if (opts.datDir === undefined) {
  process.stdout.write(USAGE + "\n");
  process.exit(0);
}

const datDir = path.resolve(opts.datDir);
const outDir = path.resolve(opts.outDir);

// Validate dat dir
if (!fs.existsSync(datDir)) {
  process.stderr.write(`[wiki-extractor] Dat directory not found: ${datDir}\n`);
  process.exit(1);
}

// Create output directory
fs.mkdirSync(outDir, { recursive: true });

// Extract and write each wiki page
const tasks: Array<{ filename: string; fn: () => string; label: string }> = [
  { filename: "items.md", fn: () => extractItems(datDir), label: "items" },
  { filename: "npcs.md", fn: () => extractNpcs(datDir), label: "NPCs" },
  { filename: "spells.md", fn: () => extractSpells(datDir), label: "spells" },
  { filename: "skills.md", fn: () => extractSkills(), label: "skills" },
  { filename: "maps.md", fn: () => extractMaps(), label: "map zones" },
];

for (const task of tasks) {
  const md = task.fn();
  const outPath = path.join(outDir, task.filename);
  fs.writeFileSync(outPath, md, "utf-8");
  const count = countRows(md);
  process.stdout.write(
    `[wiki-extractor] Written: ${path.relative(process.cwd(), outPath)} (${count} ${task.label})\n`,
  );
}
