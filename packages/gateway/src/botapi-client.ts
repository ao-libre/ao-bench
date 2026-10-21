/**
 * BotApiClient — manages a TCP connection to BotAPI.bas (or mock-server).
 *
 * One instance per gateway process; all bots share the connection.
 * Messages are newline-delimited JSON. Pending requests are tracked by a
 * per-charname queue so concurrent sends don't interleave replies.
 */

import net from "node:net";
import type { BotApiRequest, BotApiResponse } from "../../sdk/src/types.js";

const BOTAPI_HOST = process.env["BOTAPI_HOST"] ?? "127.0.0.1";
const BOTAPI_PORT = Number(process.env["BOTAPI_PORT"] ?? "4200");
const RECONNECT_DELAY_MS = 2000;

type PendingReq = {
  resolve: (r: BotApiResponse) => void;
  reject: (e: Error) => void;
};

export class BotApiClient {
  private socket: net.Socket | null = null;
  private buffer = "";
  private connected = false;
  private pendingQueue: PendingReq[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  connect(): void {
    if (this.destroyed) return;
    this.socket = new net.Socket();
    this.socket.setEncoding("utf8");

    this.socket.connect(BOTAPI_PORT, BOTAPI_HOST, () => {
      console.warn(`[gateway/botapi] Connected to BotAPI at ${BOTAPI_HOST}:${BOTAPI_PORT}`);
      this.connected = true;
    });

    this.socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let msg: BotApiResponse;
        try {
          msg = JSON.parse(trimmed) as BotApiResponse;
        } catch {
          console.error("[gateway/botapi] Invalid JSON from BotAPI:", trimmed);
          continue;
        }
        const pending = this.pendingQueue.shift();
        if (pending) {
          pending.resolve(msg);
        }
      }
    });

    this.socket.on("close", () => {
      this.connected = false;
      console.warn(`[gateway/botapi] Disconnected. Reconnecting in ${RECONNECT_DELAY_MS}ms...`);
      this.scheduleReconnect();
    });

    this.socket.on("error", (err) => {
      console.error("[gateway/botapi] Socket error:", err.message);
      // close event will fire after error, triggering reconnect
    });
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  /** Send a request and await a response. Rejects if not connected. */
  send(req: BotApiRequest): Promise<BotApiResponse> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) {
        reject(new Error("BotAPI not connected"));
        return;
      }
      this.pendingQueue.push({ resolve, reject });
      this.socket.write(JSON.stringify(req) + "\n");
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.destroy();
  }
}
