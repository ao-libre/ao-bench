import type { RunResult } from "./types.js";

/**
 * Submit a benchmark result to the leaderboard API.
 * Never throws — errors are logged and silently swallowed.
 */
export async function submitResult(
  leaderboardUrl: string,
  apiKey: string,
  result: RunResult,
): Promise<void> {
  try {
    const response = await fetch(`${leaderboardUrl}/api/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[leaderboard] Submit failed (HTTP ${response.status}): ${text}`,
      );
    }
  } catch (err) {
    console.error(
      `[leaderboard] Submit error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
