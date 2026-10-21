import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { loadTask } from "./task-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("loadTask", () => {
  it("loads the real magia-xp.yaml and returns correct fields", () => {
    const taskFile = join(__dirname, "../tasks/magia-xp.yaml");
    const task = loadTask(taskFile);

    expect(task.name).toBe("magia-xp");
    expect(task.timeLimitSeconds).toBe(300);
    expect(task.startMap).toBe(1);
    expect(task.startX).toBe(50);
    expect(task.startY).toBe(50);
    expect(task.skill).toBe("Magia");
    expect(task.description).toContain("Magia");
  });

  it("throws when a required field is missing", () => {
    // Write a minimal YAML without 'timeLimitSeconds'
    const tmpFile = join(tmpdir(), `aobench-test-${Date.now()}.yaml`);
    writeFileSync(
      tmpFile,
      `name: incomplete-task\ndescription: Missing time limit\n`,
      "utf-8",
    );

    try {
      expect(() => loadTask(tmpFile)).toThrow(/timeLimitSeconds/);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("throws when name is missing", () => {
    const tmpFile = join(tmpdir(), `aobench-test-${Date.now()}.yaml`);
    writeFileSync(
      tmpFile,
      `description: No name here\ntimeLimitSeconds: 60\n`,
      "utf-8",
    );

    try {
      expect(() => loadTask(tmpFile)).toThrow(/name/);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("parses optional numeric fields correctly", () => {
    const tmpFile = join(tmpdir(), `aobench-test-${Date.now()}.yaml`);
    writeFileSync(
      tmpFile,
      `name: test\ndescription: A test\ntimeLimitSeconds: 120\nstartMap: 5\nstartX: 10\nstartY: 20\nskill: Armas\n`,
      "utf-8",
    );

    try {
      const task = loadTask(tmpFile);
      expect(task.startMap).toBe(5);
      expect(task.startX).toBe(10);
      expect(task.startY).toBe(20);
      expect(task.skill).toBe("Armas");
    } finally {
      unlinkSync(tmpFile);
    }
  });
});
