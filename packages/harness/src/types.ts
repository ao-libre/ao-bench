export interface HarnessConfig {
  model: string;
  task: string;
  server: string;
  port: number;
  leaderboardUrl: string;
  leaderboardApiKey: string;
  gatewayPassword: string;
}

export interface TaskSpec {
  name: string;
  description: string;
  timeLimitSeconds: number;
  startMap?: number;
  startX?: number;
  startY?: number;
  skill?: string; // e.g. "Magia"
}

export interface RunResult {
  runId: string;
  model: string;
  task: string;
  xpGained: number;
  xpRate: number; // max XP in any 15s window
  durationMs: number;
  success: boolean;
  error?: string;
  log: string; // agent stdout
}
