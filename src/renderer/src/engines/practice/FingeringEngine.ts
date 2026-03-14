import type { ParsedNote } from "../midi/types";

// ── Types ──────────────────────────────────────────────────────────────

export type Finger = 1 | 2 | 3 | 4 | 5;
export type Hand = "left" | "right";

export interface FingeringResult {
  midi: number;
  finger: Finger;
  hand: Hand;
}

// ── Constants ──────────────────────────────────────────────────────────

/** Maximum comfortable stretch in semitones for each finger from thumb */
export const FINGER_REACH: Record<Finger, number> = {
  1: 8, // thumb — very flexible
  2: 5,
  3: 5,
  4: 4,
  5: 4,
};

/** Standard right-hand major scale ascending fingering (starting from tonic) */
const RH_SCALE_UP: Finger[] = [1, 2, 3, 1, 2, 3, 4, 5];
/** Standard right-hand major scale descending fingering (from octave down) */
const RH_SCALE_DOWN: Finger[] = [5, 4, 3, 2, 1, 4, 3, 2, 1];
/** Standard left-hand major scale ascending fingering */
const LH_SCALE_UP: Finger[] = [5, 4, 3, 2, 1, 3, 2, 1];
/** Standard left-hand major scale descending fingering */
const LH_SCALE_DOWN: Finger[] = [1, 2, 3, 1, 2, 3, 4, 5];

/** Major scale intervals in semitones from root */
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11, 12];
/** Natural minor scale intervals in semitones from root */
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10, 12];

/** Pitch classes that correspond to black keys (C#, D#, F#, G#, A#) */
const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

/** Check whether a MIDI note falls on a black key */
function isBlackKey(midi: number): boolean {
  return BLACK_KEY_PCS.has(midi % 12);
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Check whether a sequence of MIDI notes matches a scale pattern (ascending or
 * descending) using a sliding window. Returns the offset (0-based index) where
 * the match starts, or -1 if no match is found.
 */
function matchesScalePattern(midis: number[], intervals: number[]): number {
  if (midis.length < 3) return -1;

  for (let offset = 0; offset < midis.length; offset++) {
    const remaining = midis.length - offset;
    if (remaining < 5) break;

    // Check ascending from this offset
    const root = midis[offset];
    let matchesAsc = true;
    for (let i = 1; i < remaining && i < intervals.length; i++) {
      if (midis[offset + i] - root !== intervals[i]) {
        matchesAsc = false;
        break;
      }
    }
    if (matchesAsc) return offset;

    // Check descending from this offset
    const topNote = midis[offset];
    const octave = intervals[intervals.length - 1]; // e.g. 12
    let matchesDesc = true;
    for (let i = 1; i < remaining && i < intervals.length; i++) {
      const expectedDrop = octave - intervals[intervals.length - 1 - i];
      if (topNote - midis[offset + i] !== expectedDrop) {
        matchesDesc = false;
        break;
      }
    }
    if (matchesDesc) return offset;
  }

  return -1;
}

/** Detect whether notes form an ascending sequence */
function isAscending(midis: number[]): boolean {
  for (let i = 1; i < midis.length; i++) {
    if (midis[i] <= midis[i - 1]) return false;
  }
  return true;
}

/** Detect whether notes form a descending sequence */
function isDescending(midis: number[]): boolean {
  for (let i = 1; i < midis.length; i++) {
    if (midis[i] >= midis[i - 1]) return false;
  }
  return true;
}

/** Validate thumb-under crossing: thumb (1) can only pass under fingers 3 or 4 */
export function isValidThumbCross(
  prevFinger: Finger,
  nextFinger: Finger,
): boolean {
  // Thumb crossing under: going from 3 or 4 to 1
  if (nextFinger === 1 && (prevFinger === 3 || prevFinger === 4)) return true;
  // Finger crossing over thumb: going from 1 to 3 or 4
  if (prevFinger === 1 && (nextFinger === 3 || nextFinger === 4)) return true;
  return false;
}

// ── Main Engine ────────────────────────────────────────────────────────

/**
 * Heuristic fingering engine for piano practice.
 * Computes suggested fingerings for note sequences and chords
 * using rule-based analysis (scale detection, reach tables,
 * thumb-under rules, chord voicing patterns).
 *
 * Pure logic — no React or DOM dependencies.
 */
export class FingeringEngine {
  /**
   * Compute fingering suggestions for a sequence of notes.
   * Handles scale patterns, stepwise motion, and leaps.
   */
  computeFingering(notes: ParsedNote[], hand: Hand): FingeringResult[] {
    if (notes.length === 0) return [];

    const midis = notes.map((n) => n.midi);

    // Group notes by time to detect chords vs. single notes
    const groups = this.groupByTime(notes);
    const results: FingeringResult[] = [];
    // S6-R3-01: Track which result indices are chord notes so the sequential
    // pass doesn't overwrite correctly-assigned chord fingering.
    const chordIndices = new Set<number>();

    for (const group of groups) {
      if (group.length > 1) {
        // Chord: use chord fingering — mark indices as chord notes
        const chordMidis = group.map((n) => n.midi);
        const chordResults = this.computeChordFingering(chordMidis, hand);
        const startIdx = results.length;
        results.push(...chordResults);
        for (let i = startIdx; i < results.length; i++) {
          chordIndices.add(i);
        }
      } else {
        // Single note: will be processed in the sequential pass below
        results.push({ midi: group[0].midi, finger: 1, hand });
      }
    }

    // Sequential fingering pass for single notes only (skip chord indices)
    this.assignSequentialFingering(results, midis, hand, chordIndices);

    return results;
  }

  /**
   * Compute fingering for a chord (multiple simultaneous notes).
   * Uses interval-based lookup for common voicings.
   */
  computeChordFingering(midiNotes: number[], hand: Hand): FingeringResult[] {
    if (midiNotes.length === 0) return [];

    // Sort from lowest to highest
    const sorted = [...midiNotes].sort((a, b) => a - b);

    if (sorted.length === 1) {
      return [
        { midi: sorted[0], finger: this.defaultSingleFinger(hand), hand },
      ];
    }

    if (sorted.length === 2) {
      return this.fingering2NoteChord(sorted, hand);
    }

    if (sorted.length === 3) {
      return this.fingering3NoteChord(sorted, hand);
    }

    if (sorted.length === 4) {
      return this.fingering4NoteChord(sorted, hand);
    }

    // 5+ notes: assign 1-2-3-4-5 from bottom (RH) or top (LH)
    return this.fingeringWideChord(sorted, hand);
  }

  // ── Private: Chord fingering helpers ─────────────────────────────

  private defaultSingleFinger(hand: Hand): Finger {
    return hand === "right" ? 2 : 2;
  }

  private fingering2NoteChord(sorted: number[], hand: Hand): FingeringResult[] {
    const interval = sorted[1] - sorted[0];

    if (hand === "right") {
      if (interval <= 4) {
        // Third or smaller: 1-3
        return [
          { midi: sorted[0], finger: 1, hand },
          { midi: sorted[1], finger: 3, hand },
        ];
      }
      if (interval <= 7) {
        // Fourth to fifth: 1-5
        return [
          { midi: sorted[0], finger: 1, hand },
          { midi: sorted[1], finger: 5, hand },
        ];
      }
      // Sixth and beyond (including octave): 1-5
      return [
        { midi: sorted[0], finger: 1, hand },
        { midi: sorted[1], finger: 5, hand },
      ];
    } else {
      // Left hand: mirror (5 on bottom, 1 on top)
      if (interval <= 4) {
        return [
          { midi: sorted[0], finger: 3, hand },
          { midi: sorted[1], finger: 1, hand },
        ];
      }
      return [
        { midi: sorted[0], finger: 5, hand },
        { midi: sorted[1], finger: 1, hand },
      ];
    }
  }

  private fingering3NoteChord(sorted: number[], hand: Hand): FingeringResult[] {
    const totalSpan = sorted[2] - sorted[0];

    if (hand === "right") {
      if (totalSpan <= 7) {
        // Triad within a fifth: 1-3-5
        return [
          { midi: sorted[0], finger: 1, hand },
          { midi: sorted[1], finger: 3, hand },
          { midi: sorted[2], finger: 5, hand },
        ];
      }
      if (totalSpan <= 12) {
        // Wide triad (up to octave): 1-2-5 or 1-3-5
        const midInterval = sorted[1] - sorted[0];
        if (midInterval <= 3) {
          return [
            { midi: sorted[0], finger: 1, hand },
            { midi: sorted[1], finger: 2, hand },
            { midi: sorted[2], finger: 5, hand },
          ];
        }
        return [
          { midi: sorted[0], finger: 1, hand },
          { midi: sorted[1], finger: 3, hand },
          { midi: sorted[2], finger: 5, hand },
        ];
      }
      // Very wide: 1-3-5
      return [
        { midi: sorted[0], finger: 1, hand },
        { midi: sorted[1], finger: 3, hand },
        { midi: sorted[2], finger: 5, hand },
      ];
    } else {
      // Left hand: mirror
      if (totalSpan <= 7) {
        return [
          { midi: sorted[0], finger: 5, hand },
          { midi: sorted[1], finger: 3, hand },
          { midi: sorted[2], finger: 1, hand },
        ];
      }
      if (totalSpan <= 12) {
        const topInterval = sorted[2] - sorted[1];
        if (topInterval <= 3) {
          return [
            { midi: sorted[0], finger: 5, hand },
            { midi: sorted[1], finger: 2, hand },
            { midi: sorted[2], finger: 1, hand },
          ];
        }
        return [
          { midi: sorted[0], finger: 5, hand },
          { midi: sorted[1], finger: 3, hand },
          { midi: sorted[2], finger: 1, hand },
        ];
      }
      return [
        { midi: sorted[0], finger: 5, hand },
        { midi: sorted[1], finger: 3, hand },
        { midi: sorted[2], finger: 1, hand },
      ];
    }
  }

  private fingering4NoteChord(sorted: number[], hand: Hand): FingeringResult[] {
    if (hand === "right") {
      return [
        { midi: sorted[0], finger: 1, hand },
        { midi: sorted[1], finger: 2, hand },
        { midi: sorted[2], finger: 3, hand },
        { midi: sorted[3], finger: 5, hand },
      ];
    } else {
      return [
        { midi: sorted[0], finger: 5, hand },
        { midi: sorted[1], finger: 3, hand },
        { midi: sorted[2], finger: 2, hand },
        { midi: sorted[3], finger: 1, hand },
      ];
    }
  }

  private fingeringWideChord(sorted: number[], hand: Hand): FingeringResult[] {
    const fingers: Finger[] = [1, 2, 3, 4, 5];
    const results: FingeringResult[] = [];

    if (hand === "right") {
      for (let i = 0; i < sorted.length; i++) {
        const finger = i < 5 ? fingers[i] : 5;
        results.push({ midi: sorted[i], finger, hand });
      }
    } else {
      for (let i = 0; i < sorted.length; i++) {
        const reverseIdx = sorted.length - 1 - i;
        const finger = reverseIdx < 5 ? fingers[reverseIdx] : 5;
        results.push({ midi: sorted[i], finger, hand });
      }
    }

    return results;
  }

  // ── Private: Sequential fingering logic ──────────────────────────

  /** Group notes into simultaneous chord groups (within 50ms) */
  private groupByTime(notes: ParsedNote[]): ParsedNote[][] {
    if (notes.length === 0) return [];

    const groups: ParsedNote[][] = [];
    let currentGroup: ParsedNote[] = [notes[0]];

    for (let i = 1; i < notes.length; i++) {
      if (Math.abs(notes[i].time - currentGroup[0].time) < 0.05) {
        currentGroup.push(notes[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [notes[i]];
      }
    }
    groups.push(currentGroup);

    return groups;
  }

  /**
   * Assign fingering to sequential single notes using scale detection
   * and stepwise heuristics.
   * S6-R3-01: chordIndices parameter prevents overwriting chord fingering.
   */
  private assignSequentialFingering(
    results: FingeringResult[],
    _allMidis: number[],
    hand: Hand,
    chordIndices?: Set<number>,
  ): void {
    if (results.length <= 1) return;

    // If there are chord notes, skip scale detection (mixed chords+scales
    // are rare and the stepwise heuristic handles them better)
    if (!chordIndices || chordIndices.size === 0) {
      if (this.tryScalePattern(results, hand)) return;
    }

    // Fallback: stepwise heuristic (skips chord indices)
    this.assignStepwise(results, hand, chordIndices);
  }

  /** Attempt to match the note sequence against known scale patterns */
  private tryScalePattern(results: FingeringResult[], hand: Hand): boolean {
    const midis = results.map((r) => r.midi);
    if (midis.length < 5) return false;

    // Find best (smallest) offset across all scale patterns
    const patterns = [MAJOR_SCALE_INTERVALS, MINOR_SCALE_INTERVALS];
    let bestOffset = -1;

    for (const pattern of patterns) {
      const offset = matchesScalePattern(midis, pattern);
      if (offset >= 0 && (bestOffset < 0 || offset < bestOffset)) {
        bestOffset = offset;
        if (offset === 0) break; // can't do better than 0
      }
    }

    if (bestOffset < 0) return false;

    // Determine direction from the scale portion onward
    const scaleMidis = midis.slice(bestOffset);
    const asc = isAscending(scaleMidis);
    const desc = isDescending(scaleMidis);

    let template: Finger[];
    if (hand === "right") {
      template = asc ? RH_SCALE_UP : desc ? RH_SCALE_DOWN : RH_SCALE_UP;
    } else {
      template = asc ? LH_SCALE_UP : desc ? LH_SCALE_DOWN : LH_SCALE_UP;
    }

    // Assign scale fingering from the offset onward
    for (let i = bestOffset; i < results.length; i++) {
      results[i].finger = template[(i - bestOffset) % template.length];
    }

    // Handle prefix notes before the scale with stepwise heuristic
    if (bestOffset > 0) {
      // Create shallow copies to avoid overwriting scale-assigned fingering
      const prefix = results.slice(0, bestOffset + 1).map((r) => ({ ...r }));
      this.assignStepwise(prefix, hand);
      for (let i = 0; i < bestOffset; i++) {
        results[i].finger = prefix[i].finger;
      }
    }

    return true;
  }

  /** Stepwise heuristic for passages that are not pure scales.
   *  S6-R3-01: chordIndices are skipped to preserve chord fingering. */
  private assignStepwise(
    results: FingeringResult[],
    hand: Hand,
    chordIndices?: Set<number>,
  ): void {
    if (results.length === 0) return;

    // Find the first non-chord index to start from
    let startIdx = 0;
    while (startIdx < results.length && chordIndices?.has(startIdx)) {
      startIdx++;
    }
    if (startIdx >= results.length) return;

    // Start with a sensible finger
    const firstMidi = results[startIdx].midi;
    const lastMidi = results[results.length - 1].midi;
    const overallDirection = lastMidi - firstMidi;

    if (hand === "right") {
      results[startIdx].finger = overallDirection >= 0 ? 1 : 5;
    } else {
      results[startIdx].finger = overallDirection >= 0 ? 5 : 1;
    }

    // Avoid thumb on black keys for the starting note
    if (results[startIdx].finger === 1 && isBlackKey(results[startIdx].midi)) {
      results[startIdx].finger = 2;
    }

    let prevIdx = startIdx;
    for (let i = startIdx + 1; i < results.length; i++) {
      // S6-R3-01: Skip chord notes — their fingering is already set
      if (chordIndices?.has(i)) continue;

      const prev = results[prevIdx];
      const curr = results[i];
      const interval = curr.midi - prev.midi;
      const absInterval = Math.abs(interval);

      // Same note: same finger
      if (interval === 0) {
        curr.finger = prev.finger;
        prevIdx = i;
        continue;
      }

      // Large leap (> octave): reset fingering
      if (absInterval > 12) {
        if (hand === "right") {
          curr.finger = interval > 0 ? 1 : 5;
        } else {
          curr.finger = interval > 0 ? 5 : 1;
        }
        prevIdx = i;
        continue;
      }

      // Try to find the next logical finger
      curr.finger = this.nextFinger(prev.finger, interval, hand);

      // Avoid thumb on black keys — shift to finger 2
      if (curr.finger === 1 && isBlackKey(curr.midi)) {
        curr.finger = 2;
      }

      prevIdx = i;
    }
  }

  /**
   * Determine the next finger given the previous finger and interval direction.
   * Incorporates thumb-under crossing rules.
   */
  private nextFinger(prevFinger: Finger, interval: number, hand: Hand): Finger {
    const goingUp = interval > 0;
    const absInterval = Math.abs(interval);

    if (hand === "right") {
      if (goingUp) {
        // Right hand ascending: increment finger, with thumb-under at 3→1 or 4→1
        if (prevFinger < 5 && absInterval <= 3) {
          return (prevFinger + 1) as Finger;
        }
        // Thumb under after 3 or 4
        if (prevFinger === 3 || prevFinger === 4) {
          return 1;
        }
        // Large step: reset to 1
        if (absInterval >= 5) return 1;
        return Math.min(prevFinger + 1, 5) as Finger;
      } else {
        // Right hand descending: decrement finger, with finger-over at 1→3
        if (prevFinger > 1 && absInterval <= 3) {
          return (prevFinger - 1) as Finger;
        }
        if (prevFinger === 1) {
          return absInterval <= 4 ? 3 : 4;
        }
        if (absInterval >= 5) return 5;
        return Math.max(prevFinger - 1, 1) as Finger;
      }
    } else {
      // Left hand: mirror of right hand
      if (goingUp) {
        // Left hand ascending: decrement finger number (5→4→3→2→1)
        if (prevFinger > 1 && absInterval <= 3) {
          return (prevFinger - 1) as Finger;
        }
        if (prevFinger === 1) {
          return absInterval <= 4 ? 3 : 4;
        }
        if (absInterval >= 5) return 5;
        return Math.max(prevFinger - 1, 1) as Finger;
      } else {
        // Left hand descending: increment finger number
        if (prevFinger < 5 && absInterval <= 3) {
          return (prevFinger + 1) as Finger;
        }
        if (prevFinger === 3 || prevFinger === 4) {
          return 1;
        }
        if (absInterval >= 5) return 1;
        return Math.min(prevFinger + 1, 5) as Finger;
      }
    }
  }
}
