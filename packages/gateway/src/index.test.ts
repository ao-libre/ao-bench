/**
 * Unit tests for the HTTP handler (no live server needed).
 *
 * Uses mock IncomingMessage / ServerResponse objects to exercise
 * createHttpHandler in isolation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
import { EventEmitter } from "node:events";
import { SessionManager } from "./session-manager.js";
import { createHttpHandler } from "./http-handler.js";

// ── Minimal mock helpers ─────────────────────────────────────────────────────

function makeMockReq(
  method: string,
  url: string,
  body = "",
): IncomingMessage {
  const ee = new EventEmitter() as IncomingMessage;
  ee.method = method;
  ee.url = url;
  // setEncoding is called by readBody — provide a no-op so it doesn't throw
  (ee as unknown as { setEncoding: (enc: string) => void }).setEncoding = () => undefined;
  // Simulate body emission on next tick
  if (body) {
    setTimeout(() => {
      ee.emit("data", body);
      ee.emit("end");
    }, 0);
  } else {
    setTimeout(() => ee.emit("end"), 0);
  }
  return ee;
}

interface MockRes {
  statusCode: number;
  headers: Record<string, string | number>;
  body: string;
  res: ServerResponse;
}

function makeMockRes(): MockRes {
  const mock: MockRes = { statusCode: 200, headers: {}, body: "", res: null! };
  const res = {
    writeHead(status: number, headers?: Record<string, string | number>) {
      mock.statusCode = status;
      if (headers) Object.assign(mock.headers, headers);
    },
    end(data?: string) {
      mock.body = data ?? "";
    },
  } as unknown as ServerResponse;
  mock.res = res;
  return mock;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("createHttpHandler", () => {
  let sessions: SessionManager;
  let handler: ReturnType<typeof createHttpHandler>;

  beforeEach(() => {
    sessions = new SessionManager();
    handler = createHttpHandler(sessions);
  });

  it("GET /status returns 200 with JSON status object", async () => {
    const req = makeMockReq("GET", "/status");
    const mock = makeMockRes();

    await new Promise<void>((resolve) => {
      // handler is async; wrap so we can await it
      Promise.resolve(handler(req, mock.res)).then(resolve).catch(resolve);
    });

    expect(mock.statusCode).toBe(200);
    const parsed = JSON.parse(mock.body) as unknown;
    expect(typeof parsed).toBe("object");
    expect(parsed).not.toBeNull();
  });

  it("GET /state/Unknown returns 404 when bot has no state", async () => {
    const req = makeMockReq("GET", "/state/Unknown");
    const mock = makeMockRes();

    await new Promise<void>((resolve) => {
      Promise.resolve(handler(req, mock.res)).then(resolve).catch(resolve);
    });

    expect(mock.statusCode).toBe(404);
    const parsed = JSON.parse(mock.body) as { error?: string };
    expect(parsed.error).toBeTruthy();
  });

  it("GET /state/:bot returns 200 with state when bot exists", async () => {
    const state = {
      charname: "Bot1",
      pos: { x: 10, y: 20, map: 1 },
      heading: "south" as const,
      hp: 100,
      maxHp: 100,
      mana: 50,
      maxMana: 50,
      stamina: 100,
      maxStamina: 100,
      gold: 0,
      exp: 0,
      expNeeded: 1000,
      level: 1,
      clase: 3,
      inventory: [],
      spells: [],
      bank: [],
      bankGold: 0,
      nearbyNpcs: [],
      nearbyPlayers: [],
      statusEffects: [] as import("../../sdk/src/types.js").StatusEffect[],
      skills: {} as import("../../sdk/src/types.js").Skills,
      skillPts: 10,
      assignedSkills: 0,
      attributes: { Fuerza: 18, Agilidad: 14, Inteligencia: 10, Carisma: 12, Constitucion: 16 },
      faction: "none" as const,
      reputation: { npcKills: 0, playerKills: 0, citizensKilled: 0, criminalsKilled: 0 },
      party: null,
      quests: { active: [], doneIds: [] },
      timestamp: Date.now(),
    };
    sessions.updateState("Bot1", state);

    const req = makeMockReq("GET", "/state/Bot1");
    const mock = makeMockRes();

    await new Promise<void>((resolve) => {
      Promise.resolve(handler(req, mock.res)).then(resolve).catch(resolve);
    });

    expect(mock.statusCode).toBe(200);
    const parsed = JSON.parse(mock.body) as { state?: { charname?: string }; stateAge?: number };
    expect(parsed.state?.charname).toBe("Bot1");
  });

  it("GET /chat/:bot returns empty array when no chat exists", async () => {
    const req = makeMockReq("GET", "/chat/Bot1");
    const mock = makeMockRes();

    await new Promise<void>((resolve) => {
      Promise.resolve(handler(req, mock.res)).then(resolve).catch(resolve);
    });

    expect(mock.statusCode).toBe(200);
    const parsed = JSON.parse(mock.body) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(0);
  });

  it("POST /say/:bot appends to chat and returns {ok: true}", async () => {
    const body = JSON.stringify({ message: "hello" });
    const req = makeMockReq("POST", "/say/Bot1", body);
    const mock = makeMockRes();

    await new Promise<void>((resolve) => {
      Promise.resolve(handler(req, mock.res)).then(resolve).catch(resolve);
    });

    expect(mock.statusCode).toBe(200);
    const parsed = JSON.parse(mock.body) as { ok?: boolean };
    expect(parsed.ok).toBe(true);

    const chat = sessions.getChat("Bot1", 50);
    expect(chat).toHaveLength(1);
    expect(chat[0]!.message).toBe("hello");
  });

  it("GET /unknown returns 404", async () => {
    const req = makeMockReq("GET", "/unknown/path");
    const mock = makeMockRes();

    await new Promise<void>((resolve) => {
      Promise.resolve(handler(req, mock.res)).then(resolve).catch(resolve);
    });

    expect(mock.statusCode).toBe(404);
    const parsed = JSON.parse(mock.body) as { error?: string };
    expect(parsed.error).toBe("Not found");
  });
});
