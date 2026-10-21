/**
 * Session manager.
 *
 * Tracks:
 *   - Latest WorldState per bot (cache updated by poller)
 *   - Control session per bot (at most one)
 *   - Observe sessions per bot (many)
 *   - Chat log per bot (last 200 messages)
 *
 * State fan-out: after each poll, calls fanOut(charname) to push state to all
 * subscribed SDK sessions (control + observe). Consecutive identical frames are
 * skipped to avoid noise.
 */

import type { WorldState, GatewayServerMsg } from "../../sdk/src/types.js";

export interface ChatEntry {
  from: string;
  message: string;
  timestamp: number;
}

export interface SdkSession {
  charname: string;
  mode: "control" | "observe";
  ws: { send(data: string): void; close(code?: number, reason?: string): void };
  /** Serialized last state sent — for deduplication. */
  lastStateSent: string | null;
}

const CHAT_LIMIT = 200;

export class SessionManager {
  /** Latest WorldState per bot, keyed by charname. */
  private stateCache = new Map<string, WorldState>();
  /** Control session per bot (only one at a time). */
  private controlSessions = new Map<string, SdkSession>();
  /** Observe sessions per bot. */
  private observeSessions = new Map<string, Set<SdkSession>>();
  /** Chat log per bot. */
  private chatLog = new Map<string, ChatEntry[]>();

  // ── State cache ────────────────────────────────────────────────────────────

  updateState(charname: string, state: WorldState): void {
    this.stateCache.set(charname, state);
  }

  getState(charname: string): WorldState | undefined {
    return this.stateCache.get(charname);
  }

  listBots(): string[] {
    return [...this.stateCache.keys()];
  }

  // ── Chat log ───────────────────────────────────────────────────────────────

  appendChat(charname: string, entry: ChatEntry): void {
    let log = this.chatLog.get(charname);
    if (!log) {
      log = [];
      this.chatLog.set(charname, log);
    }
    log.push(entry);
    if (log.length > CHAT_LIMIT) {
      log.splice(0, log.length - CHAT_LIMIT);
    }
  }

  getChat(charname: string, limit = 50): ChatEntry[] {
    const log = this.chatLog.get(charname) ?? [];
    return log.slice(-limit);
  }

  // ── Session registration ───────────────────────────────────────────────────

  /**
   * Register a new SDK session.
   * If mode=control and there is already a controller, pre-empt it.
   * Returns the session object.
   */
  registerSession(session: SdkSession): { preempted: SdkSession | null } {
    let preempted: SdkSession | null = null;

    if (session.mode === "control") {
      const existing = this.controlSessions.get(session.charname);
      if (existing) {
        // Pre-empt the existing controller
        preempted = existing;
        const msg: GatewayServerMsg = {
          type: "error",
          error: "Preempted by new controller",
          code: "preempted",
        };
        try { existing.ws.send(JSON.stringify(msg)); } catch { /* already closed */ }
        try { existing.ws.close(4000, "preempted"); } catch { /* already closed */ }
      }
      this.controlSessions.set(session.charname, session);
    } else {
      let observers = this.observeSessions.get(session.charname);
      if (!observers) {
        observers = new Set();
        this.observeSessions.set(session.charname, observers);
      }
      observers.add(session);
    }

    return { preempted };
  }

  removeSession(session: SdkSession): void {
    if (session.mode === "control") {
      const current = this.controlSessions.get(session.charname);
      if (current === session) {
        this.controlSessions.delete(session.charname);
      }
    } else {
      this.observeSessions.get(session.charname)?.delete(session);
    }
  }

  getController(charname: string): SdkSession | undefined {
    return this.controlSessions.get(charname);
  }

  // ── State fan-out ──────────────────────────────────────────────────────────

  /**
   * Push the latest state to all subscribers for this bot.
   * Skips sessions where the state is identical to what was last sent.
   */
  fanOut(charname: string): void {
    const state = this.stateCache.get(charname);
    if (!state) return;

    const serialized = JSON.stringify(state);
    const msg: GatewayServerMsg = { type: "state", state };
    const msgStr = JSON.stringify(msg);

    const controller = this.controlSessions.get(charname);
    if (controller && serialized !== controller.lastStateSent) {
      controller.lastStateSent = serialized;
      try { controller.ws.send(msgStr); } catch { /* closed */ }
    }

    const observers = this.observeSessions.get(charname);
    if (observers) {
      for (const obs of observers) {
        if (serialized !== obs.lastStateSent) {
          obs.lastStateSent = serialized;
          try { obs.ws.send(msgStr); } catch { /* closed */ }
        }
      }
    }
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  getStatus(): Record<string, { controller: boolean; observers: number }> {
    const result: Record<string, { controller: boolean; observers: number }> = {};
    for (const charname of this.stateCache.keys()) {
      result[charname] = {
        controller: this.controlSessions.has(charname),
        observers: this.observeSessions.get(charname)?.size ?? 0,
      };
    }
    return result;
  }
}
