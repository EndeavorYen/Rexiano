/**
 * Manages playback speed multiplier for practice mode.
 * Pure logic — no React or DOM dependencies.
 */
export class SpeedController {
  private _multiplier: number;
  private static readonly MIN = 0.25;
  private static readonly MAX = 2.0;

  constructor(initialSpeed = 1.0) {
    this._multiplier = SpeedController._clamp(initialSpeed);
  }

  /** Current speed multiplier */
  get multiplier(): number {
    return this._multiplier;
  }

  /** Set speed multiplier (clamped to 0.25–2.0) */
  setSpeed(value: number): void {
    this._multiplier = SpeedController._clamp(value);
  }

  /**
   * Compute effective pixelsPerSecond given a base value.
   * e.g. base=200, multiplier=0.5 → 100
   */
  effectivePixelsPerSecond(base: number): number {
    return base * this._multiplier;
  }

  /** Reset to default speed (1.0x) */
  reset(): void {
    this._multiplier = 1.0;
  }

  private static _clamp(v: number): number {
    return Math.max(SpeedController.MIN, Math.min(SpeedController.MAX, v));
  }
}
