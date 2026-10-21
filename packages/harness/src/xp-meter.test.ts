import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { XpMeter } from "./xp-meter.js";

describe("XpMeter", () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;
  let now: number;

  beforeEach(() => {
    now = 1_000_000;
    dateSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it("record() + total() returns the correct total XP gained", () => {
    const meter = new XpMeter();

    now = 0;
    meter.record(100);
    now = 5_000;
    meter.record(200);
    now = 10_000;
    meter.record(350);

    expect(meter.total()).toBe(250); // 350 - 100
  });

  it("maxRate() finds the correct maximum XP in any 15s window", () => {
    const meter = new XpMeter();

    // t=0: XP 0 — baseline
    now = 0;
    meter.record(0);

    // t=5s: +10 XP  (window [0,5]: 10)
    now = 5_000;
    meter.record(10);

    // t=20s: +100 XP, but previous window has closed
    // window [5,20] = 15s exactly: 100 - 10 = 90
    now = 20_000;
    meter.record(100);

    // t=30s: +5 XP — window [20,30]: only 5
    now = 30_000;
    meter.record(105);

    // Best 15s window is [5s, 20s] = 90 XP
    expect(meter.maxRate(15_000)).toBe(90);
  });

  it("maxRate() with a single sample returns 0", () => {
    const meter = new XpMeter();
    now = 0;
    meter.record(500);

    expect(meter.maxRate()).toBe(0);
  });

  it("maxRate() with all samples in one window returns the total gained", () => {
    const meter = new XpMeter();

    now = 0;
    meter.record(0);
    now = 3_000;
    meter.record(50);
    now = 7_000;
    meter.record(120);
    now = 12_000;
    meter.record(200);

    // All within 15s → maxRate equals total
    expect(meter.maxRate(15_000)).toBe(200);
    expect(meter.total()).toBe(200);
  });

  it("total() returns 0 with fewer than 2 samples", () => {
    const meter = new XpMeter();
    expect(meter.total()).toBe(0);

    meter.record(999);
    expect(meter.total()).toBe(0);
  });
});
