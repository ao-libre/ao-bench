import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";

import {
  provisionBot,
  deprovisionBot,
  botExists,
  buildCharfile,
} from "./provisioner.js";

describe("provisioner", () => {
  const tmpDirs: string[] = [];

  function makeTmpDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aobench-test-"));
    tmpDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs.length = 0;
  });

  it("provisionBot creates a file with the correct uppercase .chr name", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("testbot", { charfileDir });

    const expectedFile = path.join(charfileDir, "TESTBOT.chr");
    expect(fs.existsSync(expectedFile)).toBe(true);
    expect(creds.charfilePath).toBe(expectedFile);
    expect(creds.charname).toBe("testbot");
  });

  it("botExists returns false before provision, true after", () => {
    const charfileDir = makeTmpDir();
    const config = { charfileDir };

    expect(botExists("mybot", config)).toBe(false);

    provisionBot("mybot", config);

    expect(botExists("mybot", config)).toBe(true);
  });

  it("deprovisionBot removes the charfile", () => {
    const charfileDir = makeTmpDir();
    const config = { charfileDir };

    provisionBot("cleanme", config);
    expect(botExists("cleanme", config)).toBe(true);

    deprovisionBot("cleanme", config);
    expect(botExists("cleanme", config)).toBe(false);
  });

  it("deprovisionBot is a no-op if file does not exist", () => {
    const charfileDir = makeTmpDir();
    // Should not throw
    expect(() =>
      deprovisionBot("ghost", { charfileDir }),
    ).not.toThrow();
  });

  it("charfile content contains [INIT] and [STATS] sections", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("sectionbot", { charfileDir });
    const content = fs.readFileSync(creds.charfilePath, "utf-8");

    expect(content).toContain("[INIT]");
    expect(content).toContain("[STATS]");
    expect(content).toContain("[FLAGS]");
    expect(content).toContain("[SKILLS]");
    expect(content).toContain("[CONTACTO]");
  });

  it("charfile uses \\r\\n line endings", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("linebot", { charfileDir });
    const raw = fs.readFileSync(creds.charfilePath, "binary");

    expect(raw).toContain("\r\n");
  });

  it("position is written correctly when map/x/y are provided", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("posbot", {
      charfileDir,
      map: 5,
      x: 42,
      y: 77,
    });
    const content = fs.readFileSync(creds.charfilePath, "utf-8");

    expect(content).toContain("Position=5-42-77");
    expect(content).toContain("LastMap=5");
  });

  it("position defaults to map=1, x=50, y=50 when not provided", () => {
    const charfileDir = makeTmpDir();
    const creds = provisionBot("defaultpos", { charfileDir });
    const content = fs.readFileSync(creds.charfilePath, "utf-8");

    expect(content).toContain("Position=1-50-50");
    expect(content).toContain("LastMap=1");
  });

  it("buildCharfile includes SkillPtsLibres=255", () => {
    const content = buildCharfile("skillbot", { map: 1, x: 50, y: 50 });
    expect(content).toContain("SkillPtsLibres=255");
  });

  it("provisionBot overwrites an existing charfile", () => {
    const charfileDir = makeTmpDir();
    const config = { charfileDir, map: 1, x: 1, y: 1 };

    provisionBot("overwrite", config);
    const first = fs.readFileSync(
      path.join(charfileDir, "OVERWRITE.chr"),
      "utf-8",
    );

    provisionBot("overwrite", { charfileDir, map: 2, x: 99, y: 88 });
    const second = fs.readFileSync(
      path.join(charfileDir, "OVERWRITE.chr"),
      "utf-8",
    );

    expect(second).toContain("Position=2-99-88");
    expect(second).not.toBe(first);
  });
});
