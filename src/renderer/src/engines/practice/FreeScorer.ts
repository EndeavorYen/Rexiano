/**
 * FreeScorer — scoring engine for Free mode practice.
 *
 * Unlike WaitMode which pauses playback, FreeScorer runs passively alongside
 * continuous playback. It tracks which notes have been played (hits) and which
 * notes have passed the hit line without being played (misses).
 *
 * Pure logic — no React or DOM dependencies.
 */
import type { ParsedTrack } from "../midi/types";

export interface FreeScorerCallbacks {
  onHit?: (midi: number, time: number) => void;
  onMiss?: (midi: number, time: number) => void;
}

/**
 * Scores notes in Free mode by comparing MIDI input against notes near the
 * current playback time. Notes are judged as hits if the correct key is pressed
 * within a tolerance window, or as misses once they pass beyond the window.
 */
export class FreeScorer {
  private _tracks: ParsedTrack[] = [];
  private _activeTracks: Set<number> = new Set();
  private _toleranceSec: number;
  /** Grace period (seconds) after passing the hit line before counting a miss */
  private _graceDelaySec: number;
  private _callbacks: FreeScorerCallbacks = {};
  /** Per-track cursors — index of earliest unjudged note */
  private _trackCursors = new Map<number, number>();
  /** Set of note keys already judged (to avoid double-counting) */
  private _judged = new Set<string>();
  private _running = false;

  /**
   * @param toleranceMs  Time window (+-ms) for accepting a hit. Default +-200ms.
   * @param graceDelayMs Extra grace period past the tolerance before marking a miss. Default 100ms.
   */
  constructor(toleranceMs = 200, graceDelayMs = 100) {
    this._toleranceSec = toleranceMs / 1000;
    this._graceDelaySec = graceDelayMs / 1000;
  }

  /** Register event callbacks */
  setCallbacks(cb: FreeScorerCallbacks): void {
    this._callbacks = cb;
  }

  /** Remove all callbacks */
  clearCallbacks(): void {
    this._callbacks = {};
  }

  /** Initialize with song tracks and active track selection */
  init(tracks: ParsedTrack[], activeTracks: Set<number>): void {
    this._tracks = tracks;
    this._activeTracks = activeTracks;
    this._judged.clear();
    this._trackCursors.clear();
    this._running = false;
  }

  /** Start scoring */
  start(): void {
    this._running = true;
  }

  /** Stop scoring */
  stop(): void {
    this._running = false;
  }

  /** Reset all state (e.g. for loop restart) */
  reset(): void {
    this._judged.clear();
    this._trackCursors.clear();
  }

  get isRunning(): boolean {
    return this._running;
  }

  /**
   * Called every frame by the ticker loop (or via a store subscriber).
   * Scans for notes that have passed beyond the grace window and marks them as misses.
   *
   * @param currentTime Current playback time in seconds
   */
  tick(currentTime: number): void {
    if (!this._running) return;

    const missDeadline = currentTime - this._toleranceSec - this._graceDelaySec;

    for (const trackIndex of this._activeTracks) {
      const track = this._tracks[trackIndex];
      if (!track) continue;

      let cursor = this._trackCursors.get(trackIndex) ?? 0;

      for (let ni = cursor; ni < track.notes.length; ni++) {
        const note = track.notes[ni];

        // Notes are time-sorted: if note is still in the future, stop
        if (note.time > missDeadline) break;

        const key = `${trackIndex}:${ni}`;

        // Already judged — advance cursor
        if (this._judged.has(key)) {
          if (ni === cursor) cursor = ni + 1;
          continue;
        }

        // Note has passed the grace window without being hit => miss
        this._judged.add(key);
        this._callbacks.onMiss?.(note.midi, note.time);
        if (ni === cursor) cursor = ni + 1;
      }

      this._trackCursors.set(trackIndex, cursor);
    }
  }

  /**
   * Check incoming MIDI input against notes near the current playback time.
   * Call this whenever the user's active MIDI notes change.
   *
   * @param activeNotes Set of MIDI note numbers currently pressed
   * @param currentTime Current playback time in seconds
   */
  checkInput(activeNotes: Set<number>, currentTime: number): void {
    if (!this._running) return;
    if (activeNotes.size === 0) return;

    for (const trackIndex of this._activeTracks) {
      const track = this._tracks[trackIndex];
      if (!track) continue;

      const cursor = this._trackCursors.get(trackIndex) ?? 0;

      for (let ni = cursor; ni < track.notes.length; ni++) {
        const note = track.notes[ni];

        // Beyond lookahead — stop scanning this track
        if (note.time > currentTime + this._toleranceSec) break;

        // Before the hit window — skip
        if (note.time < currentTime - this._toleranceSec - this._graceDelaySec)
          continue;

        const key = `${trackIndex}:${ni}`;
        if (this._judged.has(key)) continue;

        // Check if the user is pressing this note's MIDI number
        if (activeNotes.has(note.midi)) {
          this._judged.add(key);
          this._callbacks.onHit?.(note.midi, note.time);
        }
      }
    }
  }
}
