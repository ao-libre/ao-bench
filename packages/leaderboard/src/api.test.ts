import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db.js';
import {
  handlePostRun,
  handleGetLeaderboard,
  handleGetRunLog,
  handlePostBug,
} from './api.js';

// Use a fixed API key for all tests
const VALID_KEY = 'aobench-key';

beforeEach(() => {
  db.exec('DELETE FROM runs; DELETE FROM bugs;');
});

describe('handlePostRun', () => {
  it('inserts a run and returns 201 with a runId when API key is valid', () => {
    const result = handlePostRun(
      { model: 'gpt-4o', task: 'magia-xp', xp_gained: 100, xp_rate: 2.5, duration_ms: 40000, success: true, log: 'done' },
      VALID_KEY,
    );
    expect(result.status).toBe(201);
    expect((result.body as { ok: boolean; runId: string }).ok).toBe(true);
    expect(typeof (result.body as { ok: boolean; runId: string }).runId).toBe('string');
  });

  it('returns 401 when API key is wrong', () => {
    const result = handlePostRun(
      { model: 'gpt-4o', task: 'magia-xp' },
      'wrong-key',
    );
    expect(result.status).toBe(401);
  });
});

describe('handleGetLeaderboard', () => {
  it('returns empty array when no runs exist', () => {
    const result = handleGetLeaderboard('magia-xp');
    expect(result.status).toBe(200);
    expect(result.body).toEqual([]);
  });

  it('returns top run per model ordered by best xp_rate', () => {
    // Insert two runs for model A and one for model B
    handlePostRun({ model: 'model-a', task: 'magia-xp', xp_rate: 1.0 }, VALID_KEY);
    handlePostRun({ model: 'model-a', task: 'magia-xp', xp_rate: 3.0 }, VALID_KEY);
    handlePostRun({ model: 'model-b', task: 'magia-xp', xp_rate: 2.0 }, VALID_KEY);

    const result = handleGetLeaderboard('magia-xp');
    expect(result.status).toBe(200);

    const rows = result.body as Array<{ model: string; best_rate: number; runs: number }>;
    expect(rows).toHaveLength(2);
    // model-a has best_rate 3.0, should be first
    expect(rows[0]?.model).toBe('model-a');
    expect(rows[0]?.best_rate).toBe(3.0);
    expect(rows[0]?.runs).toBe(2);
    // model-b second
    expect(rows[1]?.model).toBe('model-b');
    expect(rows[1]?.best_rate).toBe(2.0);
  });
});

describe('handlePostBug', () => {
  it('inserts a bug and returns 201 with a bugId', () => {
    const result = handlePostBug({
      charname: 'Gandalf',
      description: 'Spell cast failed',
      sdk_version: '0.1.0',
    });
    expect(result.status).toBe(201);
    expect((result.body as { ok: boolean; bugId: string }).ok).toBe(true);
    expect(typeof (result.body as { ok: boolean; bugId: string }).bugId).toBe('string');
  });
});

describe('handleGetRunLog', () => {
  it('returns 404 for an unknown runId', () => {
    const result = handleGetRunLog('nonexistent-id');
    expect(result.status).toBe(404);
  });

  it('returns the log for a known runId', () => {
    const postResult = handlePostRun(
      { model: 'gpt-4o', task: 'magia-xp', log: 'step 1 done\nstep 2 done' },
      VALID_KEY,
    );
    const { runId } = postResult.body as { ok: boolean; runId: string };

    const logResult = handleGetRunLog(runId);
    expect(logResult.status).toBe(200);
    expect((logResult.body as { log: string }).log).toBe('step 1 done\nstep 2 done');
  });
});
