/**
 * Poller — sends getState to BotAPI.bas every 600ms per registered bot.
 *
 * After each successful poll, updates SessionManager and triggers fan-out.
 * Bots are registered externally (e.g., when an SDK client connects).
 */

import type { BotApiStateResponse } from "../../sdk/src/types.js";
import type { BotApiClient } from "./botapi-client.js";
import type { SessionManager } from "./session-manager.js";

const POLL_INTERVAL_MS = 600;

export class Poller {
  private timers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(
    private readonly botapi: BotApiClient,
    private readonly sessions: SessionManager,
  ) {}

  /** Start polling for a bot. Idempotent. */
  register(charname: string): void {
    if (this.timers.has(charname)) return;
    const timer = setInterval(() => void this.poll(charname), POLL_INTERVAL_MS);
    this.timers.set(charname, timer);
    // Immediate first poll
    void this.poll(charname);
  }

  /** Stop polling for a bot. */
  unregister(charname: string): void {
    const timer = this.timers.get(charname);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(charname);
    }
  }

  private async poll(charname: string): Promise<void> {
    if (!this.botapi.isConnected()) return;
    try {
      const resp = await this.botapi.send({ action: "getState", charname });
      if (resp.ok) {
        const stateResp = resp as BotApiStateResponse;
        this.sessions.updateState(charname, stateResp.state);
        this.sessions.fanOut(charname);
      }
    } catch {
      // BotAPI temporarily disconnected — suppress
    }
  }

  /** List all registered bot names. */
  registeredBots(): string[] {
    return [...this.timers.keys()];
  }

  destroyAll(): void {
    for (const timer of this.timers.values()) clearInterval(timer);
    this.timers.clear();
  }
}
