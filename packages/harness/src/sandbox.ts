import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

export interface SandboxResult {
  stdout: string;
  exitCode: number;
  timedOut: boolean;
}

/** Banned import patterns — agent code must only import @aobench/sdk */
const BANNED_IMPORTS = [/from\s+['"]fs['"]/, /from\s+['"]node:/, /from\s+['"]child_process['"]/];

/**
 * Run agent-generated TypeScript code in an isolated subprocess.
 *
 * Security: rejects code that imports anything other than @aobench/sdk
 * by scanning for banned import patterns before execution.
 */
export async function runInSandbox(
  code: string,
  timeoutMs: number,
  gatewayUrl: string,
): Promise<SandboxResult> {
  // Check for forbidden imports
  for (const pattern of BANNED_IMPORTS) {
    if (pattern.test(code)) {
      return {
        stdout: `[sandbox] Rejected: code contains a banned import matching ${pattern.toString()}`,
        exitCode: 1,
        timedOut: false,
      };
    }
  }

  const runId = randomBytes(8).toString("hex");
  const tmpFile = `/tmp/aobench-agent-${runId}.ts`;

  writeFileSync(tmpFile, code, "utf-8");

  return new Promise<SandboxResult>((resolve) => {
    let stdout = "";
    let timedOut = false;

    const child = spawn("npx", ["tsx", tmpFile], {
      env: {
        ...process.env,
        GATEWAY_URL: gatewayUrl,
      },
      // stdio: pipe stdout/stderr so we can capture them
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      // Merge stderr into stdout so the caller can see errors
      stdout += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);

      // Clean up temp file
      try {
        if (existsSync(tmpFile)) unlinkSync(tmpFile);
      } catch {
        // Best-effort cleanup — ignore errors
      }

      resolve({
        stdout,
        exitCode: code ?? 1,
        timedOut,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);

      try {
        if (existsSync(tmpFile)) unlinkSync(tmpFile);
      } catch {
        // Best-effort cleanup
      }

      resolve({
        stdout: `[sandbox] Failed to spawn process: ${err.message}\n${stdout}`,
        exitCode: 1,
        timedOut,
      });
    });
  });
}
