import type { ParsedTrack } from "../midi/types";
import type { NoteResult } from "@shared/types";

/** WaitMode state machine states */
export type WaitState = "playing" | "waiting" | "idle";

/** Callback signatures for WaitMode events */
export interface WaitModeCallbacks {
  onWait?: () => void;
  onResume?: () => void;
  onHit?: (midi: number, time: number) => void;
  onMiss?: (midi: number, time: number) => void;
}

/**
 * Core state machine for Wait Mode practice.
 * Pauses playback at each note/chord and waits for the user
 * to play the correct keys on their MIDI device.
 *
 * Pure logic — no React or DOM dependencies.
 */
export class WaitMode {
  private _state: WaitState = "idle";
  private _tracks: ParsedTrack[] = [];
  private _activeTracks: Set<number> = new Set();
  private _toleranceMs: number;
  private _callbacks: WaitModeCallbacks = {};

  /** Notes the user must currently play (empty when not waiting) */
  private _targetNotes: Set<number> = new Set();
  /** Per-note results keyed by "trackIndex:noteIndex" */
  private _noteResults: Map<string, NoteResult> = new Map();

  /**
   * @param toleranceMs Time window (±ms) around the hit line for accepting input.
   *                     Default ±200ms.
   */
  constructor(toleranceMs = 200) {
    this._toleranceMs = toleranceMs;
  }

  get state(): WaitState {
    return this._state;
  }

  get targetNotes(): ReadonlySet<number> {
    return this._targetNotes;
  }

  get noteResults(): ReadonlyMap<string, NoteResult> {
    return this._noteResults;
  }

  /** Register event callbacks */
  setCallbacks(cb: WaitModeCallbacks): void {
    this._callbacks = cb;
  }

  /** Initialize with song tracks and active track selection */
  init(tracks: ParsedTrack[], activeTracks: Set<number>): void {
    this._tracks = tracks;
    this._activeTracks = activeTracks;
    this._noteResults.clear();
    this._targetNotes.clear();
    this._state = "idle";
  }

  /** Start wait mode (called when user presses play) */
  start(): void {
    this._state = "playing";
  }

  /** Stop wait mode */
  stop(): void {
    this._state = "idle";
    this._targetNotes.clear();
  }

  /**
   * Called every frame by the ticker loop.
   * Scans for notes at the current time and pauses if needed.
   *
   * @param currentTime Current playback time in seconds
   * @returns true if playback should continue, false if paused (waiting)
   */
  tick(currentTime: number): boolean {
    if (this._state === "idle") return true;
    if (this._state === "waiting") return false;

    // Scan active tracks for notes within the tolerance window
    const toleranceSec = this._toleranceMs / 1000;
    const pendingMidis = new Set<number>();

    for (const trackIndex of this._activeTracks) {
      const track = this._tracks[trackIndex];
      if (!track) continue;

      for (let ni = 0; ni < track.notes.length; ni++) {
        const note = track.notes[ni];
        const key = `${trackIndex}:${ni}`;

        // Skip already judged notes
        if (this._noteResults.has(key)) continue;

        // Note is within tolerance window of hit line
        if (Math.abs(note.time - currentTime) <= toleranceSec) {
          pendingMidis.add(note.midi);

          // Mark as pending
          if (!this._noteResults.has(key)) {
            this._noteResults.set(key, "pending");
          }
        }

        // Note has passed beyond tolerance window → missed
        if (
          note.time < currentTime - toleranceSec &&
          !this._noteResults.has(key)
        ) {
          this._noteResults.set(key, "miss");
          this._callbacks.onMiss?.(note.midi, note.time);
        }
      }
    }

    // If there are pending notes, pause and wait for input
    if (pendingMidis.size > 0) {
      this._targetNotes = pendingMidis;
      this._state = "waiting";
      this._callbacks.onWait?.();
      return false;
    }

    return true;
  }

  /**
   * Check user input against target notes.
   * Call this whenever the user's active MIDI notes change.
   *
   * @param activeNotes Set of MIDI note numbers currently pressed
   * @returns true if all target notes were matched (resume playback)
   */
  checkInput(activeNotes: Set<number>): boolean {
    if (this._state !== "waiting") return false;
    if (this._targetNotes.size === 0) return false;

    // Check if all target notes are pressed
    let allMatched = true;
    for (const midi of this._targetNotes) {
      if (!activeNotes.has(midi)) {
        allMatched = false;
        break;
      }
    }

    if (allMatched) {
      // Mark all pending notes for this time as hit (fires onHit callbacks)
      this._markPendingAs("hit");
      this._targetNotes.clear();
      this._state = "playing";
      this._callbacks.onResume?.();
      return true;
    }

    return false;
  }

  /** Mark all currently pending notes as hit or miss */
  private _markPendingAs(result: NoteResult): void {
    for (const [key, value] of this._noteResults) {
      if (value === "pending") {
        this._noteResults.set(key, result);
        if (result === "hit") {
          // Extract midi from key for callback
          const trackIndex = parseInt(key.split(":")[0]);
          const noteIndex = parseInt(key.split(":")[1]);
          const track = this._tracks[trackIndex];
          if (track) {
            const note = track.notes[noteIndex];
            if (note) {
              this._callbacks.onHit?.(note.midi, note.time);
            }
          }
        }
      }
    }
  }

  /** Reset all state for a new practice session */
  reset(): void {
    this._noteResults.clear();
    this._targetNotes.clear();
    this._state = "idle";
  }
}
