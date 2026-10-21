import { describe, it, expect, beforeEach } from "vitest";
import { makeDefaultState } from "../src/state.js";
import { handleRequest } from "../src/handlers.js";

describe("mock-server: getState", () => {
  it("returns initial WorldState", () => {
    const bot = makeDefaultState("TestBot");
    const res = handleRequest({ action: "getState", charname: "TestBot" }, bot);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const stateRes = res as { ok: true; state: { charname: string; pos: { x: number } } };
      expect(stateRes.state.charname).toBe("TestBot");
      expect(stateRes.state.pos.x).toBe(50);
    }
  });
});

describe("mock-server: walk", () => {
  let bot: ReturnType<typeof makeDefaultState>;
  beforeEach(() => { bot = makeDefaultState("TestBot"); });

  it("moves north correctly", () => {
    const before = bot.world.pos.y;
    handleRequest({ action: "walk", charname: "TestBot", heading: "north" }, bot);
    expect(bot.world.pos.y).toBe(before - 1);
  });

  it("moves south correctly", () => {
    const before = bot.world.pos.y;
    handleRequest({ action: "walk", charname: "TestBot", heading: "south" }, bot);
    expect(bot.world.pos.y).toBe(before + 1);
  });

  it("moves east correctly", () => {
    const before = bot.world.pos.x;
    handleRequest({ action: "walk", charname: "TestBot", heading: "east" }, bot);
    expect(bot.world.pos.x).toBe(before + 1);
  });

  it("moves west correctly", () => {
    const before = bot.world.pos.x;
    handleRequest({ action: "walk", charname: "TestBot", heading: "west" }, bot);
    expect(bot.world.pos.x).toBe(before - 1);
  });

  it("rejects invalid heading", () => {
    const res = handleRequest({ action: "walk", charname: "TestBot", heading: "diagonal" }, bot);
    expect(res.ok).toBe(false);
  });
});

describe("mock-server: attack", () => {
  it("deals damage to mock NPC", () => {
    const bot = makeDefaultState("TestBot");
    const res = handleRequest({ action: "attack", charname: "TestBot" }, bot);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const r = res as { ok: true; damage: number };
      expect(r.damage).toBeGreaterThan(0);
    }
    expect(bot.world.nearbyNpcs[0]!.hp).toBeLessThan(80);
  });
});

describe("mock-server: unknown action", () => {
  it("returns error for unknown action", () => {
    const bot = makeDefaultState("TestBot");
    const res = handleRequest({ action: "teleport", charname: "TestBot" }, bot);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Unknown action");
    }
  });
});

describe("mock-server: useItem", () => {
  it("heals the character when using Pocion de Vida", () => {
    const bot = makeDefaultState("TestBot");
    bot.world.hp = 50; // take some damage
    const res = handleRequest({ action: "useItem", charname: "TestBot", slot: 2 }, bot);
    expect(res.ok).toBe(true);
    expect(bot.world.hp).toBeGreaterThan(50);
  });
});
