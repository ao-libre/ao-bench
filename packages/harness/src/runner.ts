import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

import type { HarnessConfig, RunResult } from "./types.js";
import { loadTask } from "./task-loader.js";
import { buildContext } from "./context-builder.js";
import { createAdapter } from "./llm-adapter.js";
import { runInSandbox } from "./sandbox.js";
import { XpMeter } from "./xp-meter.js";
import { submitResult } from "./leaderboard-client.js";
import { provisionBot, deprovisionBot } from "./provisioner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Parse XP samples from agent stdout.
 * Looks for lines matching: XP: <number>
 */
function parseXpLines(stdout: string): number[] {
  const values: number[] = [];
  for (const line of stdout.split("\n")) {
    const match = /XP:\s*(\d+)/.exec(line);
    if (match?.[1] !== undefined) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n)) values.push(n);
    }
  }
  return values;
}

/**
 * Extract TypeScript code from an LLM response.
 * Handles both raw code and markdown code blocks.
 */
function extractCode(response: string): string {
  // Try to extract from a ```typescript ... ``` block
  const tsBlock = /```typescript\s*([\s\S]*?)```/.exec(response);
  if (tsBlock?.[1]) return tsBlock[1].trim();

  // Fall back to a plain ``` block
  const plainBlock = /```\s*([\s\S]*?)```/.exec(response);
  if (plainBlock?.[1]) return plainBlock[1].trim();

  // Return raw response if no code block found
  return response.trim();
}

/**
 * Main benchmark orchestration.
 */
export async function runBenchmark(config: HarnessConfig): Promise<RunResult> {
  const runId = randomBytes(8).toString("hex");
  const startMs = Date.now();

  // Paths relative to this file (packages/harness/src/)
  const harnessRoot = join(__dirname, "..");
  const taskFile = join(harnessRoot, "tasks", `${config.task}.yaml`);
  const wikiDir = join(harnessRoot, "../../wiki-extractor/wiki");
  const sdkReadmePath = join(harnessRoot, "../../sdk/README.md");
  const labLogPath = join(harnessRoot, "lab_log.md");

  // 1. Load task
  const task = loadTask(taskFile);

  // 2. Build context
  const sdkReadme = existsSync(sdkReadmePath)
    ? readFileSync(sdkReadmePath, "utf-8")
    : "// SDK README not found";

  const labLog = existsSync(labLogPath)
    ? readFileSync(labLogPath, "utf-8")
    : "";

  const context = await buildContext(task, wikiDir, sdkReadme, labLog);

  // 3. Generate agent code via LLM
  const adapter = createAdapter(config.model);
  let agentCode: string;
  try {
    const response = await adapter.generate(context);
    agentCode = extractCode(response);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      runId,
      model: config.model,
      task: config.task,
      xpGained: 0,
      xpRate: 0,
      durationMs: Date.now() - startMs,
      success: false,
      error: `LLM generation failed: ${error}`,
      log: "",
    };
  }

  // 4. Provision bot character
  const charfileDir =
    process.env["CHARFILE_DIR"] ??
    join(process.env["AO_SERVER_PATH"] ?? ".", "Charfile");

  // Derive charname from model name + short timestamp suffix
  const modelSlug = config.model.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const charname = `Bot${modelSlug}${Date.now().toString(36).slice(-4).toUpperCase()}`;

  provisionBot(charname, {
    charfileDir,
    ...(task.startMap !== undefined && { map: task.startMap }),
    ...(task.startX !== undefined && { x: task.startX }),
    ...(task.startY !== undefined && { y: task.startY }),
  });

  let sandboxResult: Awaited<ReturnType<typeof runInSandbox>>;
  try {
    // 5. Run agent in sandbox
    const gatewayUrl = `ws://${config.server}:${config.port}`;
    sandboxResult = await runInSandbox(
      agentCode,
      task.timeLimitSeconds * 1000,
      gatewayUrl,
    );
  } finally {
    deprovisionBot(charname, { charfileDir });
  }

  // 6. Parse XP from stdout
  const meter = new XpMeter();
  const xpValues = parseXpLines(sandboxResult.stdout);
  for (const xp of xpValues) {
    meter.record(xp);
  }

  const xpGained = meter.total();
  const xpRate = meter.maxRate();
  const durationMs = Date.now() - startMs;

  const result: RunResult = {
    runId,
    model: config.model,
    task: config.task,
    xpGained,
    xpRate,
    durationMs,
    success: sandboxResult.exitCode === 0 && !sandboxResult.timedOut,
    log: sandboxResult.stdout,
  };

  if (sandboxResult.timedOut) {
    result.error = `Agent timed out after ${task.timeLimitSeconds}s`;
  } else if (sandboxResult.exitCode !== 0) {
    result.error = `Agent exited with code ${sandboxResult.exitCode}`;
  }

  // 7. Submit to leaderboard
  if (config.leaderboardUrl) {
    await submitResult(config.leaderboardUrl, config.leaderboardApiKey, result);
  }

  return result;
}
