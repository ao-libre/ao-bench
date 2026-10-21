/**
 * Gateway entry point.
 *
 * Wires together:
 *   - BotApiClient (TCP connection to BotAPI.bas / mock-server)
 *   - SessionManager (bot state + chat + session registry)
 *   - Poller (periodic state polling → fan-out)
 *   - HTTP server (REST endpoints via createHttpHandler)
 *   - WebSocket server (SDK client sessions via createWsSession)
 */

import http from "node:http";
import { WebSocketServer } from "ws";
import { BotApiClient } from "./botapi-client.js";
import { SessionManager } from "./session-manager.js";
import { Poller } from "./poller.js";
import { createHttpHandler } from "./http-handler.js";
import { createWsSession } from "./ws-handler.js";

const PORT = Number(process.env["PORT"] ?? 7780);

async function main(): Promise<void> {
  // 1. BotAPI TCP client
  const botapi = new BotApiClient();
  botapi.connect();

  // 2. Session manager
  const sessions = new SessionManager();

  // 3. Poller
  const poller = new Poller(botapi, sessions);

  // 4. HTTP server
  const httpHandler = createHttpHandler(sessions);
  const httpServer = http.createServer(httpHandler);

  // 5. WebSocket server — attached to the same HTTP server
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws) => {
    const handler = createWsSession(ws, sessions, poller, botapi);

    ws.on("message", (data) => {
      handler.onMessage(data.toString());
    });

    ws.on("close", () => {
      handler.onClose();
    });

    ws.on("error", (err) => {
      console.error("[gateway/ws]", err.message);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`[gateway] Listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[gateway] Fatal error:", err);
  process.exit(1);
});
