#!/usr/bin/env node
import type { HarnessConfig } from "./types.js";
import { runBenchmark } from "./runner.js";

const USAGE = `\
aobench-harness — Argentum Online AI benchmark runner

Usage:
  harness --model <model> --task <task> [options]

Options:
  --model <name>              LLM model to use (e.g. gpt-4o, claude-sonnet-4-5, scripted)
  --task <name>               Task YAML file name without extension (e.g. magia-xp)
  --server <host>             Gateway host (default: localhost)
  --port <n>                  Gateway port (default: 7780)
  --leaderboard-url <url>     Leaderboard base URL (default: '')
  --leaderboard-api-key <key> Leaderboard API key (default: '')
  -h, --help                  Show this help

Environment variables:
  OPENAI_API_KEY              Required for gpt-* / o1 / o3 models
  ANTHROPIC_API_KEY           Required for claude-* models

Examples:
  harness --model scripted --task magia-xp
  harness --model gpt-4o --task magia-xp
  harness --model claude-sonnet-4-5 --task magia-xp --server 192.168.1.10`;

function nextArg(args: string[], i: number, flag: string): string {
  const val = args[i];
  if (val === undefined) {
    console.error(`[harness] Missing value for ${flag}`);
    process.exit(1);
  }
  return val;
}

function parseArgs(argv: string[]): {
  help: boolean;
  model: string | undefined;
  task: string | undefined;
  server: string;
  port: number;
  leaderboardUrl: string;
  leaderboardApiKey: string;
} {
  const args = argv.slice(2);
  let help = false;
  let model: string | undefined;
  let task: string | undefined;
  let server = "localhost";
  let port = 7780;
  let leaderboardUrl = "";
  let leaderboardApiKey = "";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--model") {
      model = nextArg(args, ++i, "--model");
    } else if (arg === "--task") {
      task = nextArg(args, ++i, "--task");
    } else if (arg === "--server") {
      server = nextArg(args, ++i, "--server");
    } else if (arg === "--port") {
      const raw = nextArg(args, ++i, "--port");
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed)) {
        console.error(`[harness] Invalid port: ${raw}`);
        process.exit(1);
      }
      port = parsed;
    } else if (arg === "--leaderboard-url") {
      leaderboardUrl = nextArg(args, ++i, "--leaderboard-url");
    } else if (arg === "--leaderboard-api-key") {
      leaderboardApiKey = nextArg(args, ++i, "--leaderboard-api-key");
    } else if (arg !== undefined) {
      console.error(`[harness] Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return { help, model, task, server, port, leaderboardUrl, leaderboardApiKey };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (opts.help) {
    console.log(USAGE);
    process.exit(0);
  }

  if (opts.model === undefined || opts.task === undefined) {
    console.error("[harness] --model and --task are required\n");
    console.log(USAGE);
    process.exit(1);
  }

  const config: HarnessConfig = {
    model: opts.model,
    task: opts.task,
    server: opts.server,
    port: opts.port,
    leaderboardUrl: opts.leaderboardUrl,
    leaderboardApiKey: opts.leaderboardApiKey,
    gatewayPassword: process.env["GATEWAY_PASSWORD"] ?? "aobench",
  };

  console.log(
    `[harness] Running benchmark — model: ${config.model}, task: ${config.task}, server: ${config.server}:${config.port}`,
  );

  try {
    const result = await runBenchmark(config);

    console.log("\n=== Benchmark Result ===");
    console.log(`Run ID:     ${result.runId}`);
    console.log(`Model:      ${result.model}`);
    console.log(`Task:       ${result.task}`);
    console.log(`Success:    ${result.success}`);
    console.log(`XP gained:  ${result.xpGained}`);
    console.log(`XP rate:    ${result.xpRate} (max in any 15s window)`);
    console.log(`Duration:   ${(result.durationMs / 1000).toFixed(1)}s`);
    if (result.error) {
      console.log(`Error:      ${result.error}`);
    }

    process.exit(result.success ? 0 : 1);
  } catch (err) {
    console.error(
      `[harness] Fatal error: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
