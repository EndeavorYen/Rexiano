import type { PracticeScore } from "@shared/types";

/**
 * Tracks hit/miss events and computes practice session scores.
 * Pure logic — no React or DOM dependencies.
 *
 * R2-004: Now tracks timing deltas (early/late) for each hit.
 * The actual hit timestamp is passed by the caller (e.g. performance.now()
 * converted to playback time), avoiding dependence on frozen WaitMode time.
 */
export class ScoreCalculator {
  private _totalNotes = 0;
  private _hitNotes = 0;
  private _missedNotes = 0;
  private _currentStreak = 0;
  private _bestStreak = 0;

  /** Sum of all timing deltas in ms (for computing average) */
  private _timingDeltaSum = 0;
  /** Number of delta measurements */
  private _timingDeltaCount = 0;
  /** Most recent timing delta in ms */
  private _lastTimingDeltaMs: number | null = null;

  /**
   * Record a successful note hit.
   * @param _midi  MIDI note number
   * @param _time  Expected note time in seconds
   * @param timingDeltaMs  Timing delta in ms (negative=early, positive=late). Optional.
   */
  noteHit(_midi: number, _time: number, timingDeltaMs?: number): void {
    this._totalNotes++;
    this._hitNotes++;
    this._currentStreak++;
    if (this._currentStreak > this._bestStreak) {
      this._bestStreak = this._currentStreak;
    }

    // R2-004: Track timing delta if provided
    if (timingDeltaMs !== undefined) {
      this._timingDeltaSum += timingDeltaMs;
      this._timingDeltaCount++;
      this._lastTimingDeltaMs = timingDeltaMs;
    }
  }

  /** Record a missed note */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  noteMiss(_midi: number, _time: number): void {
    this._totalNotes++;
    this._missedNotes++;
    this._currentStreak = 0;
  }

  /** Get the current score snapshot */
  getScore(): PracticeScore {
    const avgTimingDeltaMs =
      this._timingDeltaCount > 0
        ? Math.round((this._timingDeltaSum / this._timingDeltaCount) * 10) / 10
        : null;

    return {
      totalNotes: this._totalNotes,
      hitNotes: this._hitNotes,
      missedNotes: this._missedNotes,
      accuracy:
        this._totalNotes === 0
          ? 0
          : Math.round((this._hitNotes / this._totalNotes) * 10000) / 100,
      currentStreak: this._currentStreak,
      bestStreak: this._bestStreak,
      avgTimingDeltaMs,
      lastTimingDeltaMs: this._lastTimingDeltaMs,
    };
  }

  /** Reset all score data */
  reset(): void {
    this._totalNotes = 0;
    this._hitNotes = 0;
    this._missedNotes = 0;
    this._currentStreak = 0;
    this._bestStreak = 0;
    this._timingDeltaSum = 0;
    this._timingDeltaCount = 0;
    this._lastTimingDeltaMs = null;
  }
}
