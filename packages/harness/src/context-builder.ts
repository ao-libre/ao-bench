import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TaskSpec } from "./types.js";

const SDK_README_MAX_CHARS = 4000;
const LAB_LOG_MAX_CHARS = 2000;

/**
 * Build the system prompt that instructs the LLM to write a bot script.
 *
 * @param task       - The task spec (name, description, time limit, etc.)
 * @param wikiDir    - Directory containing wiki markdown files (e.g. skills.md)
 * @param sdkReadme  - Full content of the @aobench/sdk README
 * @param labLog     - Recent lab log content (last 2000 chars will be used)
 */
export async function buildContext(
  task: TaskSpec,
  wikiDir: string,
  sdkReadme: string,
  labLog: string,
): Promise<string> {
  const parts: string[] = [];

  // 1. Task description
  parts.push(`## Task: ${task.name}`);
  parts.push(task.description);
  parts.push(`Time limit: ${task.timeLimitSeconds} seconds`);
  if (task.skill) parts.push(`Primary skill: ${task.skill}`);
  if (task.startMap !== undefined) parts.push(`Start map: ${task.startMap}`);
  if (task.startX !== undefined && task.startY !== undefined) {
    parts.push(`Start position: (${task.startX}, ${task.startY})`);
  }

  // 2. SDK README (truncated)
  const readme = sdkReadme.slice(0, SDK_README_MAX_CHARS);
  parts.push(`\n## SDK Reference\n\`\`\`\n${readme}\n\`\`\``);

  // 3. Wiki skills.md (if present)
  const skillsFile = join(wikiDir, "skills.md");
  if (existsSync(skillsFile)) {
    const skillsContent = readFileSync(skillsFile, "utf-8");
    parts.push(`\n## Wiki: Skills\n${skillsContent}`);
  }

  // 4. Lab log (last 2000 chars)
  if (labLog.trim().length > 0) {
    const tail = labLog.slice(-LAB_LOG_MAX_CHARS);
    parts.push(`\n## Recent Lab Log\n\`\`\`\n${tail}\n\`\`\``);
  }

  // 5. Instructions
  parts.push(`
## Instructions

Write a TypeScript script that imports AOBot from @aobench/sdk and maximizes XP.
The GATEWAY_URL env var is set. Your script will be run directly.

Requirements:
- Import AOBot from "@aobench/sdk"
- Use \`process.env["GATEWAY_URL"]\` as the gatewayUrl
- Log your current XP periodically using: console.log(\`XP: \${state.exp}\`)
- Focus on the task: ${task.description}
- The script has ${task.timeLimitSeconds} seconds to run
- Do NOT import 'fs', 'node:', or 'child_process' — only @aobench/sdk is allowed

Output only the TypeScript code inside a single \`\`\`typescript ... \`\`\` block.
`);

  return parts.join("\n");
}
