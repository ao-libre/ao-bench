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

// ─────────────────────────────────────────────────────────────────────────────
// New tests for extended actions
// ─────────────────────────────────────────────────────────────────────────────

describe("mock-server: changeHeading", () => {
  it("sets the bot heading", () => {
    const bot = makeDefaultState("TestBot");
    expect(bot.world.heading).toBe("south");
    const res = handleRequest({ action: "changeHeading", charname: "TestBot", heading: "north" }, bot);
    expect(res.ok).toBe(true);
    expect(bot.world.heading).toBe("north");
  });

  it("rejects invalid heading", () => {
    const bot = makeDefaultState("TestBot");
    const res = handleRequest({ action: "changeHeading", charname: "TestBot", heading: "diagonal" }, bot);
    expect(res.ok).toBe(false);
  });
});

describe("mock-server: commerceStart", () => {
  it("sets isInCommerce to true", () => {
    const bot = makeDefaultState("TestBot");
    expect(bot.isInCommerce).toBe(false);
    const res = handleRequest({ action: "commerceStart", charname: "TestBot" }, bot);
    expect(res.ok).toBe(true);
    expect(bot.isInCommerce).toBe(true);
    if (res.ok) {
      const r = res as { ok: true; inCommerce: boolean };
      expect(r.inCommerce).toBe(true);
    }
  });

  it("commerceEnd clears isInCommerce", () => {
    const bot = makeDefaultState("TestBot");
    handleRequest({ action: "commerceStart", charname: "TestBot" }, bot);
    handleRequest({ action: "commerceEnd", charname: "TestBot" }, bot);
    expect(bot.isInCommerce).toBe(false);
  });
});

describe("mock-server: bankStart", () => {
  it("sets isInBank to true", () => {
    const bot = makeDefaultState("TestBot");
    expect(bot.isInBank).toBe(false);
    const res = handleRequest({ action: "bankStart", charname: "TestBot" }, bot);
    expect(res.ok).toBe(true);
    expect(bot.isInBank).toBe(true);
    if (res.ok) {
      const r = res as { ok: true; inBank: boolean };
      expect(r.inBank).toBe(true);
    }
  });

  it("bankEnd clears isInBank", () => {
    const bot = makeDefaultState("TestBot");
    handleRequest({ action: "bankStart", charname: "TestBot" }, bot);
    handleRequest({ action: "bankEnd", charname: "TestBot" }, bot);
    expect(bot.isInBank).toBe(false);
  });
});

describe("mock-server: gmSpawn", () => {
  it("adds an NPC to nearbyNpcs", () => {
    const bot = makeDefaultState("TestBot");
    const before = bot.world.nearbyNpcs.length;
    const res = handleRequest({ action: "gmSpawn", charname: "TestBot", npc: 42 }, bot);
    expect(res.ok).toBe(true);
    expect(bot.world.nearbyNpcs.length).toBe(before + 1);
    const spawned = bot.world.nearbyNpcs[bot.world.nearbyNpcs.length - 1]!;
    expect(spawned.name).toBe("NPC#42");
  });

  it("also adds to spawnedNpcs", () => {
    const bot = makeDefaultState("TestBot");
    handleRequest({ action: "gmSpawn", charname: "TestBot", npc: 7 }, bot);
    expect(bot.spawnedNpcs.length).toBe(1);
    expect(bot.spawnedNpcs[0]!.name).toBe("NPC#7");
  });
});

describe("mock-server: gmCreateItem", () => {
  it("adds item to inventory", () => {
    const bot = makeDefaultState("TestBot");
    const before = bot.world.inventory.length;
    const res = handleRequest({ action: "gmCreateItem", charname: "TestBot", item: 999, amount: 5 }, bot);
    expect(res.ok).toBe(true);
    expect(bot.world.inventory.length).toBe(before + 1);
    const added = bot.world.inventory.find((i) => i.itemId === 999);
    expect(added).toBeDefined();
    expect(added!.amount).toBe(5);
    if (res.ok) {
      const r = res as { ok: true; created: { item: number; amount: number } };
      expect(r.created.item).toBe(999);
      expect(r.created.amount).toBe(5);
    }
  });
});

describe("mock-server: gmKillAllNearby", () => {
  it("clears nearbyNpcs and grants pendingXp", () => {
    const bot = makeDefaultState("TestBot");
    expect(bot.world.nearbyNpcs.length).toBeGreaterThan(0);
    const res = handleRequest({ action: "gmKillAllNearby", charname: "TestBot" }, bot);
    expect(res.ok).toBe(true);
    expect(bot.world.nearbyNpcs.length).toBe(0);
    expect(bot.pendingXp).toBeGreaterThanOrEqual(200);
    if (res.ok) {
      const r = res as { ok: true; killed: number };
      expect(r.killed).toBeGreaterThan(0);
    }
  });
});

describe("mock-server: train", () => {
  it("increases skill level by 10", () => {
    const bot = makeDefaultState("TestBot");
    const before = bot.world.skills["Armas"].level;
    const res = handleRequest({ action: "train", charname: "TestBot", skill: "Armas" }, bot);
    expect(res.ok).toBe(true);
    expect(bot.world.skills["Armas"].level).toBe(before + 10);
  });

  it("caps skill level at 100", () => {
    const bot = makeDefaultState("TestBot");
    bot.world.skills["Armas"].level = 95;
    handleRequest({ action: "train", charname: "TestBot", skill: "Armas" }, bot);
    expect(bot.world.skills["Armas"].level).toBe(100);
  });
});

describe("mock-server: doubleClick", () => {
  it("returns interacted with NPC name when clicking on NPC tile", () => {
    const bot = makeDefaultState("TestBot");
    // Goblin is at x:51, y:50
    const res = handleRequest({ action: "doubleClick", charname: "TestBot", x: 51, y: 50 }, bot);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const r = res as { ok: true; interacted?: string };
      expect(r.interacted).toBe("Goblin");
    }
  });

  it("returns clicked coords when no NPC at tile", () => {
    const bot = makeDefaultState("TestBot");
    const res = handleRequest({ action: "doubleClick", charname: "TestBot", x: 10, y: 10 }, bot);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const r = res as { ok: true; clicked?: { x: number; y: number }; interacted?: string };
      expect(r.interacted).toBeUndefined();
      expect(r.clicked).toEqual({ x: 10, y: 10 });
    }
  });
});

describe("mock-server: heal", () => {
  it("increases HP by 20", () => {
    const bot = makeDefaultState("TestBot");
    bot.world.hp = 50;
    const res = handleRequest({ action: "heal", charname: "TestBot" }, bot);
    expect(res.ok).toBe(true);
    expect(bot.world.hp).toBe(70);
    if (res.ok) {
      const r = res as { ok: true; healed: number };
      expect(r.healed).toBe(20);
    }
  });

  it("does not exceed maxHp", () => {
    const bot = makeDefaultState("TestBot");
    bot.world.hp = 95;
    handleRequest({ action: "heal", charname: "TestBot" }, bot);
    expect(bot.world.hp).toBe(100);
  });
});

describe("mock-server: workLeftClick", () => {
  it("adds exp to Talar or Minería", () => {
    const bot = makeDefaultState("TestBot");
    const talarBefore = bot.world.skills["Talar"].exp;
    const mineriaBefore = bot.world.skills["Minería"].exp;
    handleRequest({ action: "workLeftClick", charname: "TestBot", x: 50, y: 50 }, bot);
    const talarAfter = bot.world.skills["Talar"].exp;
    const mineriaAfter = bot.world.skills["Minería"].exp;
    // One of them must have gained 15 exp
    const gainedTalar = talarAfter - talarBefore;
    const gainedMineria = mineriaAfter - mineriaBefore;
    expect(gainedTalar + gainedMineria).toBe(15);
  });

  it("adds 3 pendingXp", () => {
    const bot = makeDefaultState("TestBot");
    const before = bot.pendingXp;
    handleRequest({ action: "workLeftClick", charname: "TestBot", x: 50, y: 50 }, bot);
    expect(bot.pendingXp).toBe(before + 3);
  });
});
