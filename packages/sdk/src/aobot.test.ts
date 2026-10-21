import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AOBot } from "./aobot.js";
import type { WorldState } from "./types.js";

// ─── fs/promises mock (hoisted, module-level) ───────────────────────────────
// vi.mock is hoisted to the top by vitest even though it appears here.
const appendFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  appendFile: appendFileMock,
}));


type WSEventType = "open" | "message" | "error" | "close";

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  private listeners: Map<WSEventType, ((e: unknown) => void)[]> = new Map();
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  addEventListener(type: WSEventType, handler: (e: unknown) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(handler);
    this.listeners.set(type, list);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.emit("close", {});
  }

  /** Test helper — fire an event on this socket. */
  emit(type: WSEventType, event: unknown) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }

  /** Send a JSON message from the server side. */
  serverSend(data: unknown) {
    this.emit("message", { data: JSON.stringify(data) });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLastWS(): MockWebSocket {
  const ws = MockWebSocket.instances.at(-1);
  if (!ws) throw new Error("No MockWebSocket instance found");
  return ws;
}

function makeWorldState(overrides?: Partial<WorldState>): WorldState {
  return {
    charname: "TestChar",
    pos: { x: 10, y: 10, map: 1 },
    heading: "south",
    hp: 100,
    maxHp: 100,
    mana: 50,
    maxMana: 50,
    stamina: 100,
    maxStamina: 100,
    gold: 0,
    exp: 0,
    level: 1,
    clase: 3,
    skills: {} as WorldState["skills"],
    inventory: [],
    nearbyNpcs: [],
    nearbyPlayers: [],
    statusEffects: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

/** Connect a bot and resolve the handshake, returning the bot + WS. */
async function connectBot(
  charname = "TestChar",
  opts?: ConstructorParameters<typeof AOBot>[1]
): Promise<{ bot: AOBot; ws: MockWebSocket }> {
  const bot = new AOBot(charname, opts);
  const connectPromise = bot.connect();
  const ws = getLastWS();
  ws.emit("open", {});
  ws.serverSend({ type: "connected", charname, mode: "control" });
  await connectPromise;
  return { bot, ws };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AOBot constructor defaults", () => {
  it("uses ws://localhost:7780 as default gatewayUrl", () => {
    const bot = new AOBot("Hero");
    bot.connect().catch(() => {});           // don't await — just trigger WS construction
    const ws = getLastWS();
    expect(ws.url).toBe("ws://localhost:7780");
  });

  it("accepts a custom gatewayUrl", () => {
    const bot = new AOBot("Hero", { gatewayUrl: "ws://custom:9999" });
    bot.connect().catch(() => {});
    expect(getLastWS().url).toBe("ws://custom:9999");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("waitTicks", () => {
  it("returns a Promise", () => {
    const bot = new AOBot("Hero");
    const result = bot.waitTicks(1);
    expect(result).toBeInstanceOf(Promise);
    // Clean up to avoid leaking timer
    result.catch(() => {});
  });

  it("resolves after n * 600ms with fake timers", async () => {
    vi.useFakeTimers();
    const bot = new AOBot("Hero");
    let resolved = false;
    const p = bot.waitTicks(2).then(() => { resolved = true; });

    await vi.advanceTimersByTimeAsync(1199);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(resolved).toBe(true);

    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("appendLabLog", () => {
  beforeEach(() => {
    appendFileMock.mockReset();
  });

  it("calls fs/promises appendFile with lab_log.md", async () => {
    appendFileMock.mockResolvedValue(undefined);
    const bot = new AOBot("Hero");
    await bot.appendLabLog("test message");

    expect(appendFileMock).toHaveBeenCalledOnce();
    const [path, content] = appendFileMock.mock.calls[0] as [string, string];
    expect(path).toBe("./lab_log.md");
    expect(content).toMatch(/\[.*\] test message\n/);
  });

  it("never throws even if appendFile rejects", async () => {
    appendFileMock.mockRejectedValue(new Error("disk full"));
    const bot = new AOBot("Hero");
    await expect(bot.appendLabLog("x")).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getState()", () => {
  it("throws if not connected", () => {
    const bot = new AOBot("Hero");
    expect(() => bot.getState()).toThrowError(/not connected/i);
  });

  it("throws if connected but no state received yet", async () => {
    const { bot } = await connectBot();
    expect(() => bot.getState()).toThrowError(/No state received/i);
  });

  it("returns state after a state message is received", async () => {
    const { bot, ws } = await connectBot();
    const state = makeWorldState();
    ws.serverSend({ type: "state", state });
    expect(bot.getState()).toEqual(state);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("action methods — correct action name sent", () => {
  async function getFirstSentAction(
    fn: (bot: AOBot) => Promise<unknown>
  ): Promise<{ action: string; sent: Record<string, unknown> }> {
    const { bot, ws } = await connectBot();

    const actionPromise = fn(bot);

    // Resolve the pending action by sending a result
    ws.serverSend({ type: "result", ok: true });
    await actionPromise;

    const raw = ws.sentMessages.find((m) => {
      const p = JSON.parse(m) as Record<string, unknown>;
      return p["type"] === "sdk_action";
    });
    if (!raw) throw new Error("No sdk_action message found");
    return { action: (JSON.parse(raw) as Record<string, unknown>)["action"] as string, sent: JSON.parse(raw) as Record<string, unknown> };
  }

  it("walk sends action=walk with heading", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.walk("north"));
    expect(action).toBe("walk");
    expect(sent["heading"]).toBe("north");
  });

  it("leftClick sends action=leftClick with x,y", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.leftClick(5, 7));
    expect(action).toBe("leftClick");
    expect(sent["x"]).toBe(5);
    expect(sent["y"]).toBe(7);
  });

  it("attack sends action=attack", async () => {
    const { action } = await getFirstSentAction((bot) => bot.attack());
    expect(action).toBe("attack");
  });

  it("castSpell sends action=castSpell with slot", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.castSpell(2));
    expect(action).toBe("castSpell");
    expect(sent["slot"]).toBe(2);
  });

  it("useSkill sends action=useSkill with skill", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.useSkill("Magia"));
    expect(action).toBe("useSkill");
    expect(sent["skill"]).toBe("Magia");
  });

  it("useItem sends action=useItem with slot", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.useItem(3));
    expect(action).toBe("useItem");
    expect(sent["slot"]).toBe(3);
  });

  it("equipItem sends action=equipItem with slot", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.equipItem(1));
    expect(action).toBe("equipItem");
    expect(sent["slot"]).toBe(1);
  });

  it("pickUp sends action=pickUp with x,y", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.pickUp(3, 4));
    expect(action).toBe("pickUp");
    expect(sent["x"]).toBe(3);
    expect(sent["y"]).toBe(4);
  });

  it("drop sends action=drop with slot and amount", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.drop(2, 10));
    expect(action).toBe("drop");
    expect(sent["slot"]).toBe(2);
    expect(sent["amount"]).toBe(10);
  });

  it("meditate sends action=meditate", async () => {
    const { action } = await getFirstSentAction((bot) => bot.meditate());
    expect(action).toBe("meditate");
  });

  it("rest sends action=rest", async () => {
    const { action } = await getFirstSentAction((bot) => bot.rest());
    expect(action).toBe("rest");
  });

  it("say sends action=say with message", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.say("hello"));
    expect(action).toBe("say");
    expect(sent["message"]).toBe("hello");
  });

  it("yell sends action=yell with message", async () => {
    const { action, sent } = await getFirstSentAction((bot) => bot.yell("LOUD"));
    expect(action).toBe("yell");
    expect(sent["message"]).toBe("LOUD");
  });

  it("whisper sends action=whisper with target and message", async () => {
    const { action, sent } = await getFirstSentAction((bot) =>
      bot.whisper("Friend", "psst")
    );
    expect(action).toBe("whisper");
    expect(sent["target"]).toBe("Friend");
    expect(sent["message"]).toBe("psst");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("action queue ordering", () => {
  it("resolves actions in FIFO order", async () => {
    const { bot, ws } = await connectBot();

    const results: number[] = [];

    const p1 = bot.attack().then(() => results.push(1));
    const p2 = bot.attack().then(() => results.push(2));
    const p3 = bot.attack().then(() => results.push(3));

    ws.serverSend({ type: "result", ok: true });
    ws.serverSend({ type: "result", ok: true });
    ws.serverSend({ type: "result", ok: true });

    await Promise.all([p1, p2, p3]);
    expect(results).toEqual([1, 2, 3]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("runScript", () => {
  it("calls disconnect even when fn throws", async () => {
    const bot = new AOBot("TestChar");

    // Spy on connect and disconnect before the test drives them
    const connectSpy = vi.spyOn(bot, "connect").mockResolvedValue(undefined);
    const disconnectSpy = vi.spyOn(bot, "disconnect").mockReturnValue(undefined);

    const boom = new Error("fn blew up");
    const fn = vi.fn().mockRejectedValue(boom);

    await expect(bot.runScript({}, fn)).rejects.toThrow("fn blew up");

    expect(connectSpy).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(bot);
    expect(disconnectSpy).toHaveBeenCalledOnce();
  });

  it("calls disconnect after fn resolves successfully", async () => {
    const bot = new AOBot("TestChar");

    vi.spyOn(bot, "connect").mockResolvedValue(undefined);
    const disconnectSpy = vi.spyOn(bot, "disconnect").mockReturnValue(undefined);

    const fn = vi.fn().mockResolvedValue(undefined);

    await expect(bot.runScript({}, fn)).resolves.toBeUndefined();

    expect(disconnectSpy).toHaveBeenCalledOnce();
  });

  it("throws if opts.charname differs from the bot's charname", async () => {
    const bot = new AOBot("TestChar");

    vi.spyOn(bot, "connect").mockResolvedValue(undefined);
    vi.spyOn(bot, "disconnect").mockReturnValue(undefined);

    await expect(
      bot.runScript({ charname: "OtherChar" }, async () => {})
    ).rejects.toThrow(/opts.charname/);
  });

  it("does not throw if opts.charname matches the bot's charname", async () => {
    const bot = new AOBot("TestChar");

    vi.spyOn(bot, "connect").mockResolvedValue(undefined);
    vi.spyOn(bot, "disconnect").mockReturnValue(undefined);

    await expect(
      bot.runScript({ charname: "TestChar" }, async () => {})
    ).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("bugReport", () => {
  it("posts sdkVersion, actionLog, description, and charname to /api/bugs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { bot, ws } = await connectBot("BugChar");

    // Trigger a couple of actions so actionLog is non-empty
    const p1 = bot.attack();
    ws.serverSend({ type: "result", ok: true });
    await p1;

    await bot.bugReport("something went wrong");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/bugs$/);

    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body["description"]).toBe("something went wrong");
    expect(body["charname"]).toBe("BugChar");
    expect(body["sdkVersion"]).toBe("0.1.0");
    expect(Array.isArray(body["actionLog"])).toBe(true);
    expect((body["actionLog"] as string[]).length).toBeGreaterThan(0);
    expect((body["actionLog"] as string[])[0]).toMatch(/attack/);
  });
});
