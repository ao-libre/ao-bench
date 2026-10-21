interface Sample {
  ts: number;
  xp: number;
}

/**
 * Measures XP rate using a sliding window approach.
 * Feed it cumulative XP values over time; it finds the maximum
 * XP gained in any 15-second window.
 */
export class XpMeter {
  private samples: Sample[] = [];

  /**
   * Record the current cumulative XP at this moment.
   */
  record(xp: number): void {
    this.samples.push({ ts: Date.now(), xp });
  }

  /**
   * Returns the maximum XP gained in any windowMs-length sliding window.
   * Defaults to a 15-second window.
   * Returns 0 if fewer than 2 samples exist.
   */
  maxRate(windowMs = 15_000): number {
    if (this.samples.length < 2) return 0;

    let max = 0;

    for (let i = 0; i < this.samples.length; i++) {
      const windowStart = this.samples[i];
      if (windowStart === undefined) continue;

      // Find the last sample within windowMs of this one
      for (let j = this.samples.length - 1; j > i; j--) {
        const windowEnd = this.samples[j];
        if (windowEnd === undefined) continue;

        if (windowEnd.ts - windowStart.ts <= windowMs) {
          const gained = windowEnd.xp - windowStart.xp;
          if (gained > max) max = gained;
          break;
        }
      }
    }

    return max;
  }

  /**
   * Returns total XP gained from first to last sample.
   * Returns 0 if fewer than 2 samples.
   */
  total(): number {
    if (this.samples.length < 2) return 0;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (first === undefined || last === undefined) return 0;
    return last.xp - first.xp;
  }
}
