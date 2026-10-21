import { randomUUID } from 'node:crypto';
import { db } from './db.js';

const DEFAULT_API_KEY = 'aobench-key';

interface RunBody {
  model: string;
  task: string;
  // Accept both camelCase (from harness) and snake_case
  runId?: string;
  xpGained?: number;   xp_gained?: number;
  xpRate?: number;     xp_rate?: number;
  durationMs?: number; duration_ms?: number;
  success?: boolean | number;
  error?: string | null;
  log?: string;
}

interface BugBody {
  charname: string;
  description: string;
  state_json?: string;
  sdk_version?: string;
}

function isRunBody(v: unknown): v is RunBody {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>)['model'] === 'string' &&
    typeof (v as Record<string, unknown>)['task'] === 'string'
  );
}

function isBugBody(v: unknown): v is BugBody {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Record<string, unknown>)['charname'] === 'string' &&
    typeof (v as Record<string, unknown>)['description'] === 'string'
  );
}

// POST /api/runs — store a run result
export function handlePostRun(
  body: unknown,
  apiKey: string,
): { status: number; body: unknown } {
  const expectedKey = process.env['LEADERBOARD_API_KEY'] ?? DEFAULT_API_KEY;
  if (apiKey !== expectedKey) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  if (!isRunBody(body)) {
    return { status: 400, body: { error: 'Invalid body: model and task are required' } };
  }

  const runId = body.runId ?? randomUUID();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO runs (id, model, task, xp_gained, xp_rate, duration_ms, success, error, log)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    runId,
    body.model,
    body.task,
    body.xpGained ?? body.xp_gained ?? 0,
    body.xpRate ?? body.xp_rate ?? 0,
    body.durationMs ?? body.duration_ms ?? 0,
    body.success ? 1 : 0,
    body.error ?? null,
    body.log ?? '',
  );

  return { status: 201, body: { ok: true, runId } };
}

interface LeaderboardRow {
  model: string;
  best_rate: number;
  best_xp: number;
  runs: number;
}

// GET /api/leaderboard/:task — top run per model for a task
export function handleGetLeaderboard(task: string): { status: number; body: unknown } {
  const rows = db
    .prepare(
      `SELECT model,
              MAX(xp_rate) AS best_rate,
              MAX(xp_gained) AS best_xp,
              COUNT(*) AS runs
       FROM runs
       WHERE task = ?
       GROUP BY model
       ORDER BY best_rate DESC`,
    )
    .all(task) as LeaderboardRow[];

  return { status: 200, body: rows };
}

// GET /api/runs/:runId/log — get log for a run
export function handleGetRunLog(runId: string): { status: number; body: unknown } {
  const row = db.prepare('SELECT log FROM runs WHERE id = ?').get(runId) as
    | { log: string }
    | undefined;

  if (!row) {
    return { status: 404, body: { error: 'Run not found' } };
  }

  return { status: 200, body: { log: row.log } };
}

// POST /api/bugs — store a bug report
export function handlePostBug(body: unknown): { status: number; body: unknown } {
  if (!isBugBody(body)) {
    return {
      status: 400,
      body: { error: 'Invalid body: charname and description are required' },
    };
  }

  const bugId = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO bugs (id, charname, description, state_json, sdk_version)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    bugId,
    body.charname,
    body.description,
    body.state_json ?? null,
    body.sdk_version ?? null,
  );

  return { status: 201, body: { ok: true, bugId } };
}
