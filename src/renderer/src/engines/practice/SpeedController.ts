/**
 * Manages playback speed multiplier for practice mode.
 * Supports smooth interpolation (lerp) between speed changes.
 * Pure logic — no React or DOM dependencies.
 */
export class SpeedController {
  private _currentSpeed: number;
  private _targetSpeed: number;
  private _lastLerpTime: number = -1;
  private _lerpDurationMs: number = 200;

  static readonly MIN = 0.1;
  static readonly MAX = 2.0;

  constructor(initialSpeed = 1.0) {
    const clamped = SpeedController._clamp(initialSpeed);
    this._currentSpeed = clamped;
    this._targetSpeed = clamped;
  }

  /** Current interpolated speed multiplier */
  get multiplier(): number {
    return this._currentSpeed;
  }

  /** Target speed multiplier (what we're lerping toward) */
  get targetSpeed(): number {
    return this._targetSpeed;
  }

  /** Set target speed multiplier (clamped to 0.10–2.0). Lerps toward it over ~200ms. */
  setSpeed(value: number): void {
    this._targetSpeed = SpeedController._clamp(value);
    this._lastLerpTime = -1; // will be set on next tick
  }

  /**
   * Bump speed by a delta amount (can be positive or negative).
   * Returns the new clamped target speed.
   */
  bumpSpeed(delta: number): number {
    this._targetSpeed = SpeedController._clamp(this._targetSpeed + delta);
    this._lastLerpTime = -1;
    return this._targetSpeed;
  }

  /**
   * Advance the smooth interpolation. Call once per frame.
   * @param nowMs - Current time in milliseconds (e.g. performance.now())
   * @returns The current interpolated speed multiplier.
   */
  tick(nowMs: number): number {
    if (this._currentSpeed === this._targetSpeed) return this._currentSpeed;

    // Initialize lerp start time on first tick after a speed change
    if (this._lastLerpTime < 0) {
      this._lastLerpTime = nowMs;
    }

    const elapsed = nowMs - this._lastLerpTime;
    const t = Math.min(1, elapsed / this._lerpDurationMs);
    this._currentSpeed =
      this._currentSpeed + (this._targetSpeed - this._currentSpeed) * t;

    if (t >= 1) {
      this._currentSpeed = this._targetSpeed;
    }

    return this._currentSpeed;
  }

  /**
   * Compute effective pixelsPerSecond given a base value.
   * e.g. base=200, multiplier=0.5 → 100
   */
  effectivePixelsPerSecond(base: number): number {
    return base * this._currentSpeed;
  }

  /** Reset to default speed (1.0x), immediately (no lerp). */
  reset(): void {
    this._currentSpeed = 1.0;
    this._targetSpeed = 1.0;
    this._lastLerpTime = -1;
  }

  private static _clamp(v: number): number {
    return Math.max(SpeedController.MIN, Math.min(SpeedController.MAX, v));
  }
}
