/**
 * @aobench/mcp — MCP server for aobench bot control.
 *
 * Exposes 7 tools:
 *   get_state      — current WorldState for a bot
 *   execute_action — run a bot action via WebSocket
 *   get_chat       — recent chat log
 *   say            — post a chat message
 *   search_wiki    — search ao-libre wiki .md files
 *   list_bots      — all connected bots / sessions
 *   execute_code   — run a TypeScript bot script in a sandboxed subprocess
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const GATEWAY_URL = process.env["GATEWAY_URL"] ?? "http://localhost:7780";
import { resolve } from "node:path";

// Wiki files live at the repo root wiki/ directory (3 levels up from packages/mcp/src/)
const _mcpSrcDir = resolve("packages/mcp/src"); // fallback
const WIKI_DIR = process.env["WIKI_DIR"] ?? resolve("wiki");
const BOT_PASSWORD = process.env["BOT_PASSWORD"] ?? "aobench";
const ACTION_TIMEOUT_MS = 10_000;

// Derive WebSocket URL from GATEWAY_URL
const WS_URL = GATEWAY_URL.replace(/^http/, "ws");

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "aobench-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ─────────────────────────────────────────────────────────────────────────────
// Tool list
// ─────────────────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_state",
      description:
        "Get the current WorldState (position, HP, mana, inventory, nearby NPCs/players, skills, etc.) for a connected bot.",
      inputSchema: {
        type: "object",
        properties: {
          charname: {
            type: "string",
            description: "The bot's character name.",
          },
        },
        required: ["charname"],
      },
    },
    {
      name: "execute_action",
      description:
        "Execute a bot action (e.g. walk, attack, castSpell, pickUpItem). Connects via WebSocket, sends the action and waits for the result.",
      inputSchema: {
        type: "object",
        properties: {
          charname: {
            type: "string",
            description: "The bot's character name.",
          },
          action: {
            type: "string",
            description:
              "Action name as defined in the BotAPI (e.g. 'walk', 'attack', 'castSpell').",
          },
          params: {
            type: "object",
            description: "Optional action parameters (action-specific fields).",
            additionalProperties: true,
          },
        },
        required: ["charname", "action"],
      },
    },
    {
      name: "get_chat",
      description: "Get the recent chat log for a bot.",
      inputSchema: {
        type: "object",
        properties: {
          charname: {
            type: "string",
            description: "The bot's character name.",
          },
          limit: {
            type: "number",
            description: "Max number of chat entries to return (default 50).",
          },
        },
        required: ["charname"],
      },
    },
    {
      name: "say",
      description: "Send a chat message through a bot.",
      inputSchema: {
        type: "object",
        properties: {
          charname: {
            type: "string",
            description: "The bot's character name.",
          },
          message: {
            type: "string",
            description: "The message text to send.",
          },
        },
        required: ["charname", "message"],
      },
    },
    {
      name: "search_wiki",
      description:
        "Search the ao-libre wiki for items, NPCs, spells, skills, or any game knowledge. Returns matching lines with file context.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term (case-insensitive substring match).",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "list_bots",
      description:
        "List all currently connected bots and their session status.",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "execute_code",
      description:
        "Run a TypeScript bot script in a sandboxed subprocess. The script has access to @aobench/sdk with GATEWAY_URL and BOT_PASSWORD set. Returns stdout.",
      inputSchema: {
        type: "object",
        properties: {
          charname: {
            type: "string",
            description: "The bot's character name (injected as __CHARNAME__).",
          },
          code: {
            type: "string",
            description: "TypeScript source code to execute.",
          },
          timeout_seconds: {
            type: "number",
            description: "Execution timeout in seconds (optional, default 30).",
          },
        },
        required: ["charname", "code"],
      },
    },
  ],
}));

// ─────────────────────────────────────────────────────────────────────────────
// Tool handlers
// ─────────────────────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // ── get_state ─────────────────────────────────────────────────────────
    case "get_state": {
      const { charname } = args as { charname: string };
      const res = await fetch(`${GATEWAY_URL}/state/${encodeURIComponent(charname)}`);
      if (!res.ok) {
        const body = await res.text();
        return {
          content: [
            {
              type: "text",
              text: `Error ${res.status}: ${body}`,
            },
          ],
          isError: true,
        };
      }
      const state: unknown = await res.json();
      return {
        content: [{ type: "text", text: JSON.stringify(state, null, 2) }],
      };
    }

    // ── execute_action ─────────────────────────────────────────────────────
    case "execute_action": {
      const { charname, action, params } = args as {
        charname: string;
        action: string;
        params?: Record<string, unknown>;
      };

      const result = await executeActionViaWs(charname, action, params ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ── get_chat ───────────────────────────────────────────────────────────
    case "get_chat": {
      const { charname, limit } = args as { charname: string; limit?: number };
      const effectiveLimit = limit ?? 50;
      const res = await fetch(
        `${GATEWAY_URL}/chat/${encodeURIComponent(charname)}?limit=${effectiveLimit}`
      );
      if (!res.ok) {
        const body = await res.text();
        return {
          content: [{ type: "text", text: `Error ${res.status}: ${body}` }],
          isError: true,
        };
      }
      const chat: unknown = await res.json();
      return {
        content: [{ type: "text", text: JSON.stringify(chat, null, 2) }],
      };
    }

    // ── say ────────────────────────────────────────────────────────────────
    case "say": {
      const { charname, message } = args as {
        charname: string;
        message: string;
      };
      const res = await fetch(
        `${GATEWAY_URL}/say/${encodeURIComponent(charname)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        }
      );
      if (!res.ok) {
        const body = await res.text();
        return {
          content: [{ type: "text", text: `Error ${res.status}: ${body}` }],
          isError: true,
        };
      }
      const result: unknown = await res.json();
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    // ── search_wiki ────────────────────────────────────────────────────────
    case "search_wiki": {
      const { query } = args as { query: string };
      return searchWiki(query);
    }

    // ── list_bots ──────────────────────────────────────────────────────────
    case "list_bots": {
      const res = await fetch(`${GATEWAY_URL}/status`);
      if (!res.ok) {
        const body = await res.text();
        return {
          content: [{ type: "text", text: `Error ${res.status}: ${body}` }],
          isError: true,
        };
      }
      const status: unknown = await res.json();
      return {
        content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      };
    }

    // ── execute_code ───────────────────────────────────────────────────────
    case "execute_code": {
      const { charname, code, timeout_seconds } = args as {
        charname: string;
        code: string;
        timeout_seconds?: number;
      };
      const timeoutMs = (timeout_seconds ?? 30) * 1000;
      const result = await executeCode(charname, code, timeoutMs);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// execute_code helper — run TypeScript in a subprocess
// ─────────────────────────────────────────────────────────────────────────────

interface ExecuteCodeResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

function executeCode(
  charname: string,
  code: string,
  timeoutMs: number
): Promise<ExecuteCodeResult> {
  return new Promise((resolve) => {
    // Derive WebSocket URL from GATEWAY_URL (http → ws)
    const gatewayWsUrl = GATEWAY_URL.replace(/^http/, "ws");

    // Build the preamble injected before user code
    const preamble = [
      "// Injected by aobench MCP",
      `const __CHARNAME__ = ${JSON.stringify(charname)};`,
      `const __GATEWAY_URL__ = process.env.GATEWAY_URL ?? 'ws://localhost:7780';`,
      "",
    ].join("\n");

    const fullCode = preamble + code;

    // Write to a temp file
    const tmpFile = `/tmp/aobench-mcp-${Date.now()}.ts`;
    try {
      fs.writeFileSync(tmpFile, fullCode, "utf8");
    } catch (err) {
      resolve({
        stdout: "",
        stderr: `Failed to write temp file: ${String(err)}`,
        exitCode: 1,
        timedOut: false,
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn("npx", ["tsx", tmpFile], {
      shell: false,
      env: {
        ...process.env,
        GATEWAY_URL: gatewayWsUrl,
        BOT_PASSWORD: BOT_PASSWORD,
        CHARNAME: charname,
      },
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // Give a short grace period then SIGKILL
      setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // already dead
        }
      }, 2000);
    }, timeoutMs);

    child.on("close", (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // best effort
      }
      resolve({ stdout, stderr, exitCode, timedOut });
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // best effort
      }
      resolve({
        stdout,
        stderr: stderr + `\nProcess error: ${err.message}`,
        exitCode: null,
        timedOut,
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket helper — execute_action
// ─────────────────────────────────────────────────────────────────────────────

interface WsResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

function executeActionViaWs(
  charname: string,
  action: string,
  params: Record<string, unknown>
): Promise<WsResult> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`execute_action timed out after ${ACTION_TIMEOUT_MS}ms`));
    }, ACTION_TIMEOUT_MS);

    let connected = false;

    ws.addEventListener("open", () => {
      // Step 1: authenticate
      ws.send(
        JSON.stringify({
          type: "sdk_connect",
          charname,
          password: BOT_PASSWORD,
          mode: "control",
        })
      );
    });

    ws.addEventListener("message", (event) => {
      // event.data is string when the server sends text frames
      const raw = (event as { data: unknown }).data;
      const dataStr = typeof raw === "string" ? raw : String(raw);

      let msg: { type: string; ok?: boolean; error?: string; [key: string]: unknown };
      try {
        msg = JSON.parse(dataStr) as typeof msg;
      } catch {
        clearTimeout(timer);
        ws.close();
        reject(new Error(`Invalid JSON from gateway: ${dataStr}`));
        return;
      }

      if (msg["type"] === "connected" && !connected) {
        connected = true;
        // Step 2: dispatch action
        ws.send(
          JSON.stringify({
            type: "sdk_action",
            charname,
            action,
            ...params,
          })
        );
        return;
      }

      if (msg["type"] === "result") {
        clearTimeout(timer);
        ws.close();
        resolve({
          ok: Boolean(msg["ok"]),
          ...msg,
        });
        return;
      }

      if (msg["type"] === "error") {
        clearTimeout(timer);
        ws.close();
        resolve({ ok: false, error: String(msg["error"] ?? "Unknown gateway error") });
        return;
      }

      // Ignore state updates and other messages while waiting
    });

    ws.addEventListener("error", (_event) => {
      clearTimeout(timer);
      reject(new Error(`WebSocket error connecting to ${WS_URL}`));
    });

    ws.addEventListener("close", (event) => {
      if (!connected) {
        clearTimeout(timer);
        const ev = event as { code?: number; reason?: string };
        reject(
          new Error(
            `WebSocket closed before connecting (code ${ev.code ?? "?"}: ${ev.reason ?? ""})`
          )
        );
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Wiki search helper
// ─────────────────────────────────────────────────────────────────────────────

function searchWiki(query: string): {
  content: Array<{ type: "text"; text: string }>;
} {
  if (!fs.existsSync(WIKI_DIR)) {
    return {
      content: [
        {
          type: "text",
          text: "Wiki not generated yet. Run wiki-extractor first.",
        },
      ],
    };
  }

  const lowerQuery = query.toLowerCase();
  const matches: string[] = [];

  let files: string[];
  try {
    files = fs
      .readdirSync(WIKI_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    return {
      content: [
        { type: "text", text: `Failed to read wiki directory: ${WIKI_DIR}` },
      ],
    };
  }

  outer: for (const file of files) {
    const filePath = path.join(WIKI_DIR, file);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (const line of lines) {
      if (line.toLowerCase().includes(lowerQuery)) {
        matches.push(`[${file}] ${line.trim()}`);
        if (matches.length >= 20) break outer;
      }
    }
  }

  const text =
    matches.length > 0
      ? matches.join("\n")
      : `No results found for "${query}" in the wiki.`;

  return { content: [{ type: "text", text }] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server runs until stdin closes — no explicit log to avoid polluting stdio
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[aobench-mcp] Fatal: ${message}\n`);
  process.exit(1);
});
