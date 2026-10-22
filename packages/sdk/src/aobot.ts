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


  // ── Extended player actions ──────────────────────────────────────────────

  doubleClick(x: number, y: number): Promise<BotApiOkResponse> {
    return this.sendAction("doubleClick", { x, y });
  }
  changeHeading(heading: Heading): Promise<BotApiOkResponse> {
    return this.sendAction("changeHeading", { heading });
  }
  workLeftClick(x: number, y: number): Promise<BotApiOkResponse> {
    return this.sendAction("workLeftClick", { x, y });
  }
  useSpellMacro(): Promise<BotApiOkResponse> {
    return this.sendAction("useSpellMacro", {});
  }
  moveItem(from: number, to: number): Promise<BotApiOkResponse> {
    return this.sendAction("moveItem", { from, to });
  }
  commerceStart(): Promise<BotApiOkResponse> {
    return this.sendAction("commerceStart", {});
  }
  commerceBuy(slot: number, amount: number): Promise<BotApiOkResponse> {
    return this.sendAction("commerceBuy", { slot, amount });
  }
  commerceSell(slot: number, amount: number): Promise<BotApiOkResponse> {
    return this.sendAction("commerceSell", { slot, amount });
  }
  commerceEnd(): Promise<BotApiOkResponse> {
    return this.sendAction("commerceEnd", {});
  }
  userCommerceOffer(slot: number, amount = 1, gold = 0): Promise<BotApiOkResponse> {
    return this.sendAction("userCommerceOffer", { slot, amount, gold });
  }
  userCommerceOk(): Promise<BotApiOkResponse> {
    return this.sendAction("userCommerceOk", {});
  }
  userCommerceReject(): Promise<BotApiOkResponse> {
    return this.sendAction("userCommerceReject", {});
  }
  userCommerceEnd(): Promise<BotApiOkResponse> {
    return this.sendAction("userCommerceEnd", {});
  }
  bankStart(): Promise<BotApiOkResponse> {
    return this.sendAction("bankStart", {});
  }
  bankDeposit(slot: number, amount: number): Promise<BotApiOkResponse> {
    return this.sendAction("bankDeposit", { slot, amount });
  }
  bankExtractItem(slot: number, amount: number): Promise<BotApiOkResponse> {
    return this.sendAction("bankExtractItem", { slot, amount });
  }
  bankDepositGold(amount: number): Promise<BotApiOkResponse> {
    return this.sendAction("bankDepositGold", { amount });
  }
  bankExtractGold(amount: number): Promise<BotApiOkResponse> {
    return this.sendAction("bankExtractGold", { amount });
  }
  bankEnd(): Promise<BotApiOkResponse> {
    return this.sendAction("bankEnd", {});
  }
  craftBlacksmith(item: number): Promise<BotApiOkResponse> {
    return this.sendAction("craftBlacksmith", { item });
  }
  craftCarpenter(item: number): Promise<BotApiOkResponse> {
    return this.sendAction("craftCarpenter", { item });
  }
  train(npc: number, skill: SkillName): Promise<BotApiOkResponse> {
    return this.sendAction("train", { npc, skill });
  }
  partyCreate(): Promise<BotApiOkResponse> {
    return this.sendAction("partyCreate", {});
  }
  partyJoin(leader: string): Promise<BotApiOkResponse> {
    return this.sendAction("partyJoin", { leader });
  }
  partyLeave(): Promise<BotApiOkResponse> {
    return this.sendAction("partyLeave", {});
  }
  partyMessage(message: string): Promise<BotApiOkResponse> {
    return this.sendAction("partyMessage", { message });
  }
  guildMessage(message: string): Promise<BotApiOkResponse> {
    return this.sendAction("guildMessage", { message });
  }
  shareNpc(): Promise<BotApiOkResponse> {
    return this.sendAction("shareNpc", {});
  }
  stopSharingNpc(): Promise<BotApiOkResponse> {
    return this.sendAction("stopSharingNpc", {});
  }
  resucitate(): Promise<BotApiOkResponse> {
    return this.sendAction("resucitate", {});
  }
  heal(): Promise<BotApiOkResponse> {
    return this.sendAction("heal", {});
  }
  home(): Promise<BotApiOkResponse> {
    return this.sendAction("home", {});
  }
  enlist(): Promise<BotApiOkResponse> {
    return this.sendAction("enlist", {});
  }
  changeDescription(desc: string): Promise<BotApiOkResponse> {
    return this.sendAction("changeDescription", { desc });
  }
  dragSpell(from: number, to: number): Promise<BotApiOkResponse> {
    return this.sendAction("dragSpell", { from, to });
  }

  // ── New player actions (BotAPI v2) ───────────────────────────────────────

  /** Assign free skill points. Must be called before natural training works.
   *  distribution keys are exact skill names (e.g. "Armas", "Defensa").
   *  Total points must not exceed getState().skillPts. */
  assignSkillPoints(distribution: Partial<Record<SkillName, number>>): Promise<BotApiOkResponse> {
    return this.sendAction("assignSkillPoints", { distribution });
  }

  /** Talk to a quest NPC. First call shows details + queues accept; second call
   *  (when quest already active) finishes it and grants XP. Pass x,y of the NPC. */
  quest(x: number, y: number): Promise<BotApiOkResponse> {
    return this.sendAction("quest", { x, y });
  }

  /** Accept the quest that was just offered via quest(). */
  questAccept(): Promise<BotApiOkResponse> {
    return this.sendAction("questAccept", {});
  }

  /** Abandon an active quest by slot number (1-based, from getState().quests.active). */
  questAbandon(slot: number): Promise<BotApiOkResponse> {
    return this.sendAction("questAbandon", { slot });
  }

  /** Refresh the active + done quest list (updates getState().quests). */
  questListRequest(): Promise<BotApiOkResponse> {
    return this.sendAction("questListRequest", {});
  }

  /** Get details for a specific active quest by slot number. */
  questDetailsRequest(slot: number): Promise<BotApiOkResponse> {
    return this.sendAction("questDetailsRequest", { slot });
  }

  /** Accept a party join request from `member`. Leader only. */
  partyAccept(member: string): Promise<BotApiOkResponse> {
    return this.sendAction("partyAccept", { member });
  }

  /** Kick `member` from the party. Leader only. */
  partyKick(member: string): Promise<BotApiOkResponse> {
    return this.sendAction("partyKick", { member });
  }

  /** Transfer party leadership to `member`. */
  partySetLeader(member: string): Promise<BotApiOkResponse> {
    return this.sendAction("partySetLeader", { member });
  }

  /** List online party members and their XP. */
  partyOnline(): Promise<BotApiOkResponse> {
    return this.sendAction("partyOnline", {});
  }

  /** Request party formation info. */
  requestPartyForm(): Promise<BotApiOkResponse> {
    return this.sendAction("requestPartyForm", {});
  }

  /** Leave the current army faction (/RETIRAR). */
  leaveFaction(): Promise<BotApiOkResponse> {
    return this.sendAction("leaveFaction", {});
  }

  /** Order your pet to stand still. */
  petStand(): Promise<BotApiOkResponse> {
    return this.sendAction("petStand", {});
  }

  /** Order your pet to follow you. */
  petFollow(): Promise<BotApiOkResponse> {
    return this.sendAction("petFollow", {});
  }

  /** Free / release your pet. */
  releasePet(): Promise<BotApiOkResponse> {
    return this.sendAction("releasePet", {});
  }

  /** Upgrade an item at an upgrade NPC. `slot` = inventory slot of the item. */
  itemUpgrade(slot: number): Promise<BotApiOkResponse> {
    return this.sendAction("itemUpgrade", { slot });
  }

  /** Open the craftsman's crafting dialogue (after doubleClick on artisan NPC). */
  initCrafting(): Promise<BotApiOkResponse> {
    return this.sendAction("initCrafting", {});
  }

  /** Create an item via the craftsman. `item` = recipe/item index. */
  craftsmanCreate(item: number): Promise<BotApiOkResponse> {
    return this.sendAction("craftsmanCreate", { item });
  }

  /** Send a duel challenge to `target`. Optional `gold` wager. */
  fightSend(target: string, gold = 0): Promise<BotApiOkResponse> {
    return this.sendAction("fightSend", { target, gold });
  }

  /** Accept an incoming duel challenge. */
  fightAccept(): Promise<BotApiOkResponse> {
    return this.sendAction("fightAccept", {});
  }

  /** Initiate a player-to-player trade with `target`. */
  userCommerceCreate(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("userCommerceCreate", { target });
  }

  /** Confirm the current player-to-player trade (both sides must confirm). */
  userCommerceConfirm(): Promise<BotApiOkResponse> {
    return this.sendAction("userCommerceConfirm", {});
  }

  /** Send a chat message during NPC commerce. */
  commerceChat(message: string): Promise<BotApiOkResponse> {
    return this.sendAction("commerceChat", { message });
  }

  /** Move an item between inventory and bank. `fromBank=true` = bank→inv. */
  moveBank(slot: number, fromBank = false): Promise<BotApiOkResponse> {
    return this.sendAction("moveBank", { slot, fromBank });
  }

  /** Move a spell between hotbar slots. */
  moveSpell(from: number, to: number): Promise<BotApiOkResponse> {
    return this.sendAction("moveSpell", { from, to });
  }

  /** Post a message to the in-game forum. `type`: 0=general, 1=real, 2=caos. */
  forumPost(title: string, body: string, type = 0): Promise<BotApiOkResponse> {
    return this.sendAction("forumPost", { title, body, type });
  }

  /** Add a player to your friends list. */
  addAmigo(name: string): Promise<BotApiOkResponse> {
    return this.sendAction("addAmigo", { name });
  }

  /** Remove a player from your friends list. */
  delAmigo(name: string): Promise<BotApiOkResponse> {
    return this.sendAction("delAmigo", { name });
  }

  /** List your online friends. */
  onAmigos(): Promise<BotApiOkResponse> {
    return this.sendAction("onAmigos", {});
  }

  /** Send a message to all online friends. */
  msgAmigos(message: string): Promise<BotApiOkResponse> {
    return this.sendAction("msgAmigos", { message });
  }

  /** Look up information about another character by name. */
  lookProcess(name: string): Promise<BotApiOkResponse> {
    return this.sendAction("lookProcess", { name });
  }

  /** Open the consultation / help panel. */
  consultation(): Promise<BotApiOkResponse> {
    return this.sendAction("consultation", {});
  }

  /** Link a Discord account. `code` = Discord auth code. */
  discord(code: string): Promise<BotApiOkResponse> {
    return this.sendAction("discord", { code });
  }

  /** Request the online player count. */
  online(): Promise<BotApiOkResponse> {
    return this.sendAction("online", {});
  }

  /** Start the guild founding process. `guildName` = desired guild name. */
  guildFundate(guildName: string): Promise<BotApiOkResponse> {
    return this.sendAction("guildFundate", { guildName });
  }

  /** Complete the guild founding (second step after guildFundate). */
  guildFundation(): Promise<BotApiOkResponse> {
    return this.sendAction("guildFundation", {});
  }

  // ── GM actions (require GM privileges on the character) ──────────────────

  gmGoToChar(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmGoToChar", { target });
  }
  gmWarpChar(target: string, map: number, x: number, y: number): Promise<BotApiOkResponse> {
    return this.sendAction("gmWarpChar", { target, map, x, y });
  }
  gmWarpMe(): Promise<BotApiOkResponse> {
    return this.sendAction("gmWarpMe", {});
  }
  gmSummon(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmSummon", { target });
  }
  gmSpawn(npc: number): Promise<BotApiOkResponse> {
    return this.sendAction("gmSpawn", { npc });
  }
  gmKillNpc(npc: number): Promise<BotApiOkResponse> {
    return this.sendAction("gmKillNpc", { npc });
  }
  gmKillAllNearby(): Promise<BotApiOkResponse> {
    return this.sendAction("gmKillAllNearby", {});
  }
  gmCreateItem(item: number, amount = 1): Promise<BotApiOkResponse> {
    return this.sendAction("gmCreateItem", { item, amount });
  }
  gmDestroyItems(): Promise<BotApiOkResponse> {
    return this.sendAction("gmDestroyItems", {});
  }
  gmRevive(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmRevive", { target });
  }
  gmKick(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmKick", { target });
  }
  gmBan(target: string, reason: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmBan", { target, reason });
  }
  gmSilence(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmSilence", { target });
  }
  gmJail(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmJail", { target });
  }
  gmInvisible(): Promise<BotApiOkResponse> {
    return this.sendAction("gmInvisible", {});
  }
  gmMessage(message: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmMessage", { message });
  }
  gmServerMessage(message: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmServerMessage", { message });
  }
  gmRain(): Promise<BotApiOkResponse> {
    return this.sendAction("gmRain", {});
  }
  gmTeleportCreate(map: number, x: number, y: number, destMap: number, destX: number, destY: number): Promise<BotApiOkResponse> {
    return this.sendAction("gmTeleportCreate", { map, x, y, destMap, destX, destY });
  }
  gmEditChar(target: string, field: number, value: number): Promise<BotApiOkResponse> {
    return this.sendAction("gmEditChar", { target, field, value });
  }
  gmSetDesc(target: string, desc: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmSetDesc", { target, desc });
  }
  gmCreateNpc(npc: number): Promise<BotApiOkResponse> {
    return this.sendAction("gmCreateNpc", { npc });
  }
  gmMakeDumb(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmMakeDumb", { target });
  }
  gmMakeDumbNoMore(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmMakeDumbNoMore", { target });
  }
  gmRequestCharInfo(target: string): Promise<BotApiOkResponse> {
    return this.sendAction("gmRequestCharInfo", { target });
  }

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
