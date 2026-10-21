/**
 * HTTP handler for the gateway.
 *
 * Routes:
 *   GET  /status       — returns sessions.getStatus() as JSON
 *   GET  /state/:bot   — returns latest WorldState for the bot, 404 if unknown
 *   GET  /chat/:bot    — returns last 50 chat entries for the bot
 *   POST /say/:bot     — appends a chat message: body {message: string}
 *   *                  — 404 {error: "Not found"}
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { SessionManager } from "./session-manager.js";

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export function createHttpHandler(sessions: SessionManager): Handler {
  return async function handler(req: IncomingMessage, res: ServerResponse) {
    const method = req.method ?? "GET";
    const url = req.url ?? "/";

    // Strip query string
    const path = url.split("?")[0] ?? "/";

    // GET /status
    if (method === "GET" && path === "/status") {
      sendJson(res, 200, sessions.getStatus());
      return;
    }

    // GET /state/:bot
    const stateMatch = /^\/state\/([^/]+)$/.exec(path);
    if (method === "GET" && stateMatch) {
      const charname = decodeURIComponent(stateMatch[1]!);
      const state = sessions.getState(charname);
      if (!state) {
        sendJson(res, 404, { error: "Bot not found" });
        return;
      }
      sendJson(res, 200, { state, stateAge: Date.now() - (state.timestamp ?? 0) });
      return;
    }

    // GET /chat/:bot
    const chatMatch = /^\/chat\/([^/]+)$/.exec(path);
    if (method === "GET" && chatMatch) {
      const charname = decodeURIComponent(chatMatch[1]!);
      const entries = sessions.getChat(charname, 50);
      sendJson(res, 200, entries);
      return;
    }

    // POST /say/:bot
    const sayMatch = /^\/say\/([^/]+)$/.exec(path);
    if (method === "POST" && sayMatch) {
      const charname = decodeURIComponent(sayMatch[1]!);
      let body: string;
      try {
        body = await readBody(req);
      } catch {
        sendJson(res, 400, { error: "Failed to read request body" });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        sendJson(res, 400, { error: "Invalid JSON body" });
        return;
      }

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        typeof (parsed as Record<string, unknown>)["message"] !== "string"
      ) {
        sendJson(res, 400, { error: 'Body must be {"message": string}' });
        return;
      }

      const message = (parsed as { message: string }).message;
      sessions.appendChat(charname, {
        from: "http",
        message,
        timestamp: Date.now(),
      });
      sendJson(res, 200, { ok: true });
      return;
    }

    // Fallback
    sendJson(res, 404, { error: "Not found" });
  };
}
