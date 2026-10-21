import { appendFile } from "node:fs/promises";
import type {
  WorldState,
  Heading,
  SkillName,
  BotApiOkResponse,
  GatewayConnectMsg,
  GatewayActionMsg,
  GatewayServerMsg,
} from "./types.js";

export interface AOBotOptions {
  gatewayUrl?: string;
  password?: string;
  mode?: "control" | "observe";
}

interface PendingAction {
  resolve: (value: BotApiOkResponse) => void;
  reject: (reason: Error) => void;
}

interface ChatEntry {
  from: string;
  message: string;
  timestamp: number;
}

export class AOBot {
  private readonly charname: string;
  private readonly gatewayUrl: string;
  private readonly password: string;
  private readonly mode: "control" | "observe";

  private ws: WebSocket | null = null;
  private _state: WorldState | null = null;
  private _connected: boolean = false;
  private _actionQueue: PendingAction[] = [];
  private _chatLog: ChatEntry[] = [];
  private _actionLog: string[] = [];

  constructor(charname: string, opts?: AOBotOptions) {
    this.charname = charname;
    this.gatewayUrl = opts?.gatewayUrl ?? "ws://localhost:7780";
    this.password = opts?.password ?? "aobench";
    this.mode = opts?.mode ?? "control";
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.ws?.close();
        reject(new Error("Connection timeout after 10s"));
      }, 10_000);

      const ws = new WebSocket(this.gatewayUrl);
      this.ws = ws;

      ws.addEventListener("open", () => {
        const msg: GatewayConnectMsg = {
          type: "sdk_connect",
          charname: this.charname,
          password: this.password,
          mode: this.mode,
        };
        ws.send(JSON.stringify(msg));
      });

      ws.addEventListener("message", (event: MessageEvent) => {
        let parsed: GatewayServerMsg;
        try {
          parsed = JSON.parse(event.data as string) as GatewayServerMsg;
        } catch {
          return;
        }

        if (!this._connected) {
          // Still in handshake phase — only care about connected/error
          if (parsed.type === "connected") {
            clearTimeout(timeoutId);
            this._connected = true;
            this._setupMessageHandler(ws);
            resolve();
          } else if (parsed.type === "error") {
            clearTimeout(timeoutId);
            reject(new Error(parsed.error));
          }
        }
      });

      ws.addEventListener("error", () => {
        clearTimeout(timeoutId);
        reject(new Error("WebSocket error during connect"));
      });

      ws.addEventListener("close", () => {
        if (!this._connected) {
          clearTimeout(timeoutId);
          reject(new Error("WebSocket closed before connected"));
        }
        this._connected = false;
        // Drain pending actions with an error
        const err = new Error("WebSocket closed");
        for (const pending of this._actionQueue) {
          pending.reject(err);
        }
        this._actionQueue = [];
      });
    });
  }

  disconnect(): void {
    this._connected = false;
    this.ws?.close();
    this.ws = null;
  }

  // ─── State ─────────────────────────────────────────────────────────────────

  getState(): WorldState {
    if (!this._connected) {
      throw new Error("AOBot is not connected");
    }
    if (this._state === null) {
      throw new Error("No state received yet");
    }
    return this._state;
  }

  // ─── Movement ──────────────────────────────────────────────────────────────

  walk(heading: Heading): Promise<BotApiOkResponse> {
    return this.sendAction("walk", { heading });
  }

  async walkTo(x: number, y: number): Promise<void> {
    const MAX_ITERS = 200;
    for (let i = 0; i < MAX_ITERS; i++) {
      const state = this.getState();
      const { pos } = state;
      if (pos.x === x && pos.y === y) return;

      // Prefer x-axis movement first
      let heading: Heading;
      if (pos.x !== x) {
        heading = pos.x < x ? "east" : "west";
      } else {
        heading = pos.y < y ? "south" : "north";
      }

      await this.walk(heading);
      await this.waitTicks(1);
    }
  }

  // ─── Interaction ───────────────────────────────────────────────────────────

  leftClick(x: number, y: number): Promise<BotApiOkResponse> {
    return this.sendAction("leftClick", { x, y });
  }

  attack(): Promise<BotApiOkResponse> {
    return this.sendAction("attack");
  }

  castSpell(slot: number): Promise<BotApiOkResponse> {
    return this.sendAction("castSpell", { slot });
  }

  useSkill(skill: SkillName): Promise<BotApiOkResponse> {
    return this.sendAction("useSkill", { skill });
  }

  useItem(slot: number): Promise<BotApiOkResponse> {
    return this.sendAction("useItem", { slot });
  }

  equipItem(slot: number): Promise<BotApiOkResponse> {
    return this.sendAction("equipItem", { slot });
  }

  pickUp(x: number, y: number): Promise<BotApiOkResponse> {
    return this.sendAction("pickUp", { x, y });
  }

  drop(slot: number, amount: number): Promise<BotApiOkResponse> {
    return this.sendAction("drop", { slot, amount });
  }

  // ─── Character states ──────────────────────────────────────────────────────

  meditate(): Promise<BotApiOkResponse> {
    return this.sendAction("meditate");
  }

  rest(): Promise<BotApiOkResponse> {
    return this.sendAction("rest");
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────

  say(message: string): Promise<BotApiOkResponse> {
    return this.sendAction("say", { message });
  }

  yell(message: string): Promise<BotApiOkResponse> {
    return this.sendAction("yell", { message });
  }

  whisper(target: string, message: string): Promise<BotApiOkResponse> {
    return this.sendAction("whisper", { target, message });
  }

  // ─── Script runner ─────────────────────────────────────────────────────────

  async runScript(
    opts: { charname?: string },
    fn: (bot: AOBot) => Promise<void>
  ): Promise<void> {
    if (opts.charname !== undefined && opts.charname !== this.charname) {
      throw new Error(
        `runScript: opts.charname "${opts.charname}" does not match this bot's charname "${this.charname}"`
      );
    }
    await this.connect();
    try {
      await fn(this);
    } finally {
      this.disconnect();
    }
  }

  // ─── Timing ────────────────────────────────────────────────────────────────

  waitTicks(n: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, n * 600));
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  async appendLabLog(text: string): Promise<void> {
    try {
      const line = `[${new Date().toISOString()}] ${text}\n`;
      await appendFile("./lab_log.md", line, "utf8");
    } catch {
      // Never throws
    }
  }

  async bugReport(description: string): Promise<void> {
    try {
      const base = process.env["LEADERBOARD_URL"] ?? "http://localhost:3000";
      await fetch(`${base}/api/bugs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          state: this._state,
          charname: this.charname,
          sdkVersion: "0.1.0",
          actionLog: this._actionLog.slice(-20),
        }),
      });
    } catch {
      // Never throws
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private sendAction(
    action: string,
    params?: Record<string, unknown>
  ): Promise<BotApiOkResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this._connected) {
        reject(new Error("AOBot is not connected"));
        return;
      }

      const entry = `${new Date().toISOString()} ${action} ${JSON.stringify(params ?? {})}`;
      this._actionLog.push(entry);
      if (this._actionLog.length > 50) {
        this._actionLog.shift();
      }

      const msg: GatewayActionMsg = {
        type: "sdk_action",
        action,
        charname: this.charname,
        ...params,
      };

      this._actionQueue.push({ resolve, reject });
      this.ws.send(JSON.stringify(msg));
    });
  }

  private _setupMessageHandler(ws: WebSocket): void {
    ws.addEventListener("message", (event: MessageEvent) => {
      let parsed: GatewayServerMsg;
      try {
        parsed = JSON.parse(event.data as string) as GatewayServerMsg;
      } catch {
        return;
      }

      switch (parsed.type) {
        case "state": {
          this._state = parsed.state;
          break;
        }

        case "result": {
          const pending = this._actionQueue.shift();
          if (!pending) break;
          if (parsed.ok) {
            // Build a BotApiOkResponse from the result message fields
            const { type: _type, ok, ...rest } = parsed;
            pending.resolve({ ok: true, ...rest } as BotApiOkResponse);
          } else {
            pending.reject(new Error(parsed.error ?? "Action failed"));
          }
          break;
        }

        case "error": {
          // A gateway-level error — reject the oldest pending action if any,
          // otherwise just note it (preemption, etc.)
          const pending = this._actionQueue.shift();
          if (pending) {
            pending.reject(new Error(parsed.error));
          }
          break;
        }

        // "connected" is handled in the connect() handshake path and ignored here
        default:
          break;
      }
    });
  }
}
