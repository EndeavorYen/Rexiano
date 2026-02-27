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

/** Structured info for a note awaiting user input */
interface PendingNoteInfo {
  trackIndex: number;
  noteIndex: number;
  midi: number;
  time: number;
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
  /** Per-track scan cursors — index of earliest unjudged note */
  private _trackCursors = new Map<number, number>();
  /** Reusable set for pending MIDI numbers (avoids allocation per tick) */
  private _pendingMidis = new Set<number>();
  /** Structured info for currently pending notes (avoids string parsing) */
  private _pendingNoteDetails: PendingNoteInfo[] = [];

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

  /** Remove all callbacks (severs closure references on dispose) */
  clearCallbacks(): void {
    this._callbacks = {};
  }

  /** Initialize with song tracks and active track selection */
  init(tracks: ParsedTrack[], activeTracks: Set<number>): void {
    this._tracks = tracks;
    this._activeTracks = activeTracks;
    this._noteResults.clear();
    this._targetNotes.clear();
    this._trackCursors.clear();
    this._pendingNoteDetails.length = 0;
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
   * Uses per-track cursors and sorted-note early-exit for O(window) per frame.
   *
   * @param currentTime Current playback time in seconds
   * @returns true if playback should continue, false if paused (waiting)
   */
  tick(currentTime: number): boolean {
    if (this._state === "idle") return true;
    if (this._state === "waiting") return false;

    const toleranceSec = this._toleranceMs / 1000;
    const pendingMidis = this._pendingMidis;
    pendingMidis.clear();
    this._pendingNoteDetails.length = 0;

    for (const trackIndex of this._activeTracks) {
      const track = this._tracks[trackIndex];
      if (!track) continue;

      let cursor = this._trackCursors.get(trackIndex) ?? 0;

      for (let ni = cursor; ni < track.notes.length; ni++) {
        const note = track.notes[ni];

        // Notes are time-sorted: if beyond lookahead, stop scanning this track
        if (note.time > currentTime + toleranceSec) break;

        const key = `${trackIndex}:${ni}`;

        // Already judged — advance cursor past contiguous judged notes
        if (this._noteResults.has(key)) {
          if (ni === cursor) cursor = ni + 1;
          continue;
        }

        // Note within tolerance window → pending
        if (note.time >= currentTime - toleranceSec) {
          pendingMidis.add(note.midi);
          this._noteResults.set(key, "pending");
          this._pendingNoteDetails.push({
            trackIndex,
            noteIndex: ni,
            midi: note.midi,
            time: note.time,
          });
        } else {
          // Past tolerance window → missed
          this._noteResults.set(key, "miss");
          this._callbacks.onMiss?.(note.midi, note.time);
          if (ni === cursor) cursor = ni + 1;
        }
      }

      this._trackCursors.set(trackIndex, cursor);
    }

    // If there are pending notes, pause and wait for input
    if (pendingMidis.size > 0) {
      this._targetNotes = new Set(pendingMidis);
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
    for (const midi of this._targetNotes) {
      if (!activeNotes.has(midi)) return false;
    }

    // All matched — mark pending notes as hit and resume
    this._markPendingAs("hit");
    this._targetNotes.clear();
    this._state = "playing";
    this._callbacks.onResume?.();
    return true;
  }

  /** Mark all currently pending notes as hit or miss */
  private _markPendingAs(result: NoteResult): void {
    for (const pn of this._pendingNoteDetails) {
      const key = `${pn.trackIndex}:${pn.noteIndex}`;
      this._noteResults.set(key, result);
      if (result === "hit") {
        this._callbacks.onHit?.(pn.midi, pn.time);
      }
    }
    this._pendingNoteDetails.length = 0;
  }

  /** Reset all state for a new practice session or loop restart */
  reset(): void {
    this._noteResults.clear();
    this._targetNotes.clear();
    this._trackCursors.clear();
    this._pendingNoteDetails.length = 0;
    this._state = "idle";
  }
}
