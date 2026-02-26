/**
 * Manages A-B loop range for section practice.
 * Pure logic — no React or DOM dependencies.
 */
export class LoopController {
  private _startTime: number | null = null
  private _endTime: number | null = null

  /** Whether a loop range is currently set */
  get isActive(): boolean {
    return this._startTime !== null && this._endTime !== null
  }

  /** Loop start time in seconds, or null */
  get startTime(): number | null {
    return this._startTime
  }

  /** Loop end time in seconds, or null */
  get endTime(): number | null {
    return this._endTime
  }

  /**
   * Set the loop range. Start must be < end.
   * Returns false if the range is invalid.
   */
  setRange(start: number, end: number): boolean {
    if (start >= end || start < 0) return false
    this._startTime = start
    this._endTime = end
    return true
  }

  /** Clear the loop range */
  clear(): void {
    this._startTime = null
    this._endTime = null
  }

  /**
   * Check if the current playback time has passed the loop end.
   * Returns true if playback should jump back to loop start.
   */
  shouldLoop(currentTime: number): boolean {
    if (!this.isActive) return false
    return currentTime >= this._endTime!
  }

  /** Get the time to seek to when looping (the start point) */
  getLoopStart(): number {
    return this._startTime ?? 0
  }
}
