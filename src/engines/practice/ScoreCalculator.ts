import type { PracticeScore } from "@shared/types";

/**
 * Tracks hit/miss events and computes practice session scores.
 * Pure logic — no React or DOM dependencies.
 */
export class ScoreCalculator {
  private _totalNotes = 0;
  private _hitNotes = 0;
  private _missedNotes = 0;
  private _currentStreak = 0;
  private _bestStreak = 0;

  /** Record a successful note hit */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  noteHit(_midi: number, _time: number): void {
    this._totalNotes++;
    this._hitNotes++;
    this._currentStreak++;
    if (this._currentStreak > this._bestStreak) {
      this._bestStreak = this._currentStreak;
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
    };
  }

  /** Reset all score data */
  reset(): void {
    this._totalNotes = 0;
    this._hitNotes = 0;
    this._missedNotes = 0;
    this._currentStreak = 0;
    this._bestStreak = 0;
  }
}
