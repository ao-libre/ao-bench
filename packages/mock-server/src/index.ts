/**
 * Mock BotAPI.bas server — TCP JSON server on port 4200.
 *
 * Simulates the VB6 BotAPI.bas module for local development.
 * Each newline-delimited JSON message is dispatched to the appropriate handler.
 * Multiple simultaneous connections are supported; each connection can register
 * a charname and gets its own isolated WorldState.
 *
 * Protocol (same as BotAPI.bas):
 *   client → server:  {"action":"getState","charname":"Bot1"}\n
 *   server → client:  {"ok":true,"state":{...}}\n
 */

import net from "node:net";
import { makeDefaultState } from "./state.js";
import { handleRequest } from "./handlers.js";
import type { BotApiRequest } from "../../sdk/src/types.js";

const PORT = 4200;

// Global bot state table: charname → BotState
const bots = new Map<string, ReturnType<typeof makeDefaultState>>();

function getOrCreateBot(charname: string) {
  let bot = bots.get(charname);
  if (!bot) {
    bot = makeDefaultState(charname);
    bots.set(charname, bot);
    console.warn(`[mock-server] New bot registered: ${charname}`);
  }
  return bot;
}

const server = net.createServer((socket) => {
  const addr = `${socket.remoteAddress ?? "?"}:${socket.remotePort ?? "?"}`;
  console.warn(`[mock-server] Connection from ${addr}`);

  let buffer = "";

  socket.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");

    // Messages are newline-delimited
    const lines = buffer.split("\n");
    // Last element is incomplete fragment (may be "")
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let req: BotApiRequest;
      try {
        req = JSON.parse(trimmed) as BotApiRequest;
      } catch {
        const errMsg = JSON.stringify({ ok: false, error: "Invalid JSON" });
        socket.write(errMsg + "\n");
        continue;
      }

      if (!req.charname || typeof req.charname !== "string") {
        const errMsg = JSON.stringify({ ok: false, error: "charname is required" });
        socket.write(errMsg + "\n");
        continue;
      }

      const bot = getOrCreateBot(req.charname);
      const response = handleRequest(req, bot);
      socket.write(JSON.stringify(response) + "\n");
    }
  });

  socket.on("close", () => {
    console.warn(`[mock-server] Disconnected: ${addr}`);
  });

  socket.on("error", (err) => {
    console.error(`[mock-server] Socket error (${addr}):`, err.message);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.warn(`[mock-server] BotAPI mock listening on port ${PORT}`);
  console.warn(`[mock-server] Test: echo '{"action":"getState","charname":"Bot1"}' | nc localhost ${PORT}`);
});

server.on("error", (err) => {
  console.error("[mock-server] Server error:", err);
  process.exit(1);
});
