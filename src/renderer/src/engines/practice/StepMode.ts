/**
 * StepMode — note-by-note advancement for practice.
 * The user advances through the song one note/chord at a time
 * using arrow keys or sustain pedal. Uses the same chord grouping
 * window as WaitMode (80ms) for consistency.
 *
 * Pure logic — no React or DOM dependencies.
 */
import type { ParsedNote, ParsedTrack } from "../midi/types";

/** A group of notes that should be played simultaneously (a chord) */
export interface StepChord {
  /** All notes in this chord group */
  notes: ParsedNote[];
  /** Start time of the earliest note in the group (seconds) */
  time: number;
}

export class StepMode {
  private _tracks: ParsedTrack[] = [];
  private _activeTracks = new Set<number>();
  /** Flattened and chord-grouped sequence of notes/chords */
  private _steps: StepChord[] = [];
  /** Current position in the step sequence */
  private _currentIndex = 0;

  /** Max time (seconds) within which near-simultaneous notes are grouped as a chord */
  private _chordWindowSec = 0.08; // 80ms — same as WaitMode

  /** Load tracks and build the step sequence */
  setTracks(tracks: ParsedTrack[], activeTracks: Set<number>): void {
    this._tracks = tracks;
    this._activeTracks = activeTracks;
    this._steps = this._buildSteps();
    this._currentIndex = 0;
  }

  /** Current step index (0-based) */
  get currentIndex(): number {
    return this._currentIndex;
  }

  /** Total number of steps */
  get totalSteps(): number {
    return this._steps.length;
  }

  /** Whether we've reached the end */
  get isAtEnd(): boolean {
    return this._currentIndex >= this._steps.length;
  }

  /** Get the notes at the current position, or null if at end */
  getCurrentNotes(): StepChord | null {
    if (this._currentIndex >= this._steps.length) return null;
    return this._steps[this._currentIndex];
  }

  /**
   * Advance to the next step and return the chord at the new position.
   * Returns null if already at the end.
   */
  advance(): StepChord | null {
    if (this._currentIndex >= this._steps.length) return null;
    this._currentIndex++;
    return this.getCurrentNotes();
  }

  /**
   * Go back to the previous step and return the chord at the new position.
   * Returns null if already at the beginning.
   */
  goBack(): StepChord | null {
    if (this._currentIndex <= 0) return null;
    this._currentIndex--;
    return this.getCurrentNotes();
  }

  /** Reset to the beginning */
  reset(): void {
    this._currentIndex = 0;
  }

  /**
   * Build the flattened, chord-grouped step sequence from active tracks.
   * Collects all notes from active tracks, sorts by time, then groups
   * notes within the chord window into single steps.
   */
  private _buildSteps(): StepChord[] {
    const allNotes: ParsedNote[] = [];

    for (const trackIndex of this._activeTracks) {
      const track = this._tracks[trackIndex];
      if (!track) continue;
      for (const note of track.notes) {
        allNotes.push(note);
      }
    }

    if (allNotes.length === 0) return [];

    // Sort by time, then by pitch
    allNotes.sort((a, b) => a.time - b.time || a.midi - b.midi);

    // Group into chords using the same window as WaitMode
    const steps: StepChord[] = [];
    let currentGroup: ParsedNote[] = [allNotes[0]];
    let groupStart = allNotes[0].time;

    for (let i = 1; i < allNotes.length; i++) {
      const note = allNotes[i];
      if (note.time - groupStart <= this._chordWindowSec) {
        currentGroup.push(note);
      } else {
        steps.push({ notes: currentGroup, time: groupStart });
        currentGroup = [note];
        groupStart = note.time;
      }
    }
    // Push the last group
    steps.push({ notes: currentGroup, time: groupStart });

    return steps;
  }
}
