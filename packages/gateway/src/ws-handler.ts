/**
 * WebSocket handler — processes messages from SDK clients.
 *
 * Flow:
 *   1. Client sends sdk_connect → gateway registers session, starts poller
 *   2. Client sends sdk_action → gateway forwards to BotAPI, returns result
 *   3. Gateway pushes state updates via fan-out (from poller)
 */

import type {
  GatewayClientMsg,
  GatewayConnectMsg,
  GatewayActionMsg,
  GatewayServerMsg,
} from "../../sdk/src/types.js";
import type { SessionManager, SdkSession } from "./session-manager.js";
import type { Poller } from "./poller.js";
import type { BotApiClient } from "./botapi-client.js";

// Simple password check — replace with real auth when needed
const BOT_PASSWORD = process.env["BOT_PASSWORD"] ?? "aobench";

interface WsLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export function createWsSession(
  ws: WsLike,
  sessions: SessionManager,
  poller: Poller,
  botapi: BotApiClient,
): {
  onMessage(data: string): void;
  onClose(): void;
} {
  let currentSession: SdkSession | null = null;

  function send(msg: GatewayServerMsg): void {
    try { ws.send(JSON.stringify(msg)); } catch { /* closed */ }
  }

  function onMessage(raw: string): void {
    let msg: GatewayClientMsg;
    try {
      msg = JSON.parse(raw) as GatewayClientMsg;
    } catch {
      send({ type: "error", error: "Invalid JSON" });
      return;
    }

    if (msg.type === "sdk_connect") {
      handleConnect(msg as GatewayConnectMsg);
    } else if (msg.type === "sdk_action") {
      handleAction(msg as GatewayActionMsg);
    } else {
      send({ type: "error", error: `Unknown message type: ${(msg as { type: string }).type}` });
    }
  }

  function handleConnect(msg: GatewayConnectMsg): void {
    if (msg.password !== BOT_PASSWORD) {
      send({ type: "error", error: "Unauthorized", code: "unauthorized" });
      ws.close(4001, "unauthorized");
      return;
    }

    const session: SdkSession = {
      charname: msg.charname,
      mode: msg.mode,
      ws,
      lastStateSent: null,
    };

    const { preempted } = sessions.registerSession(session);
    currentSession = session;

    if (preempted) {
      console.warn(`[gateway/ws] Preempted controller for ${msg.charname}`);
    }

    // Ensure poller is running for this bot
    poller.register(msg.charname);

    const connectedMsg: GatewayServerMsg = {
      type: "connected",
      charname: msg.charname,
      mode: msg.mode,
    };
    send(connectedMsg);

    // Send current cached state immediately if available
    const cached = sessions.getState(msg.charname);
    if (cached) {
      send({ type: "state", state: cached });
    }
  }

  async function handleAction(msg: GatewayActionMsg): Promise<void> {
    if (!currentSession) {
      send({ type: "error", error: "Not connected", code: "unauthorized" });
      return;
    }
    if (currentSession.mode !== "control") {
      send({ type: "error", error: "Observer sessions cannot send actions", code: "unauthorized" });
      return;
    }

    if (!botapi.isConnected()) {
      send({ type: "result", ok: false, error: "BotAPI not connected" });
      return;
    }

    try {
      const { type: _type, ...rest } = msg;
      void _type;
      const response = await botapi.send(rest as Parameters<typeof botapi.send>[0]);
      send({ type: "result", ...response });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send({ type: "result", ok: false, error: message });
    }
  }

  function onClose(): void {
    if (currentSession) {
      sessions.removeSession(currentSession);
      console.warn(`[gateway/ws] Session closed: ${currentSession.charname} (${currentSession.mode})`);
    }
  }

  return { onMessage, onClose };
}
