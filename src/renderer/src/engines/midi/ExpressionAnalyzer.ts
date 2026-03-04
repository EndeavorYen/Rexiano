/**
 * ExpressionAnalyzer — Detects expression markings from MIDI data.
 *
 * Pure logic module (no React dependencies). Analyzes:
 * - Tempo changes: rit. (ritardando) when BPM decreases >5%, accel. (accelerando) when >5% increase
 * - Staccato: notes whose actual duration is <50% of the median note duration
 * - Legato: consecutive notes in the same track where note N overlaps with note N+1 by >10ms
 *
 * Results are deduplicated within a 0.5s window per expression type.
 */

import type {
  ParsedTrack,
  ParsedNote,
  TempoEvent,
  ExpressionMarking,
} from "./types";

/** Threshold for tempo change detection: >5% change = significant */
const TEMPO_CHANGE_THRESHOLD = 0.05;

/** Staccato: notes shorter than this fraction of median duration */
const STACCATO_RATIO = 0.5;

/** Legato: overlap must exceed this value (seconds) */
const LEGATO_OVERLAP_THRESHOLD = 0.01;

/** Nearby markings of the same type within this window are deduplicated */
const DEDUP_WINDOW_SECONDS = 0.5;

/**
 * Detect ritardando (rit.) and accelerando (accel.) from tempo change events.
 *
 * Compares consecutive tempo events. If BPM decreases by more than 5%, marks rit.
 * If BPM increases by more than 5%, marks accel.
 */
export function detectTempoExpressions(
  tempos: TempoEvent[],
): ExpressionMarking[] {
  const expressions: ExpressionMarking[] = [];

  for (let i = 1; i < tempos.length; i++) {
    const prev = tempos[i - 1];
    const curr = tempos[i];
    const ratio = curr.bpm / prev.bpm;

    if (ratio < 1 - TEMPO_CHANGE_THRESHOLD) {
      expressions.push({ time: curr.time, type: "rit" });
    } else if (ratio > 1 + TEMPO_CHANGE_THRESHOLD) {
      expressions.push({ time: curr.time, type: "accel" });
    }
  }

  return expressions;
}

/**
 * Compute the median duration across all notes in all tracks.
 * Returns 0 if no notes exist.
 */
export function computeMedianDuration(tracks: ParsedTrack[]): number {
  const durations: number[] = [];
  for (const track of tracks) {
    for (const note of track.notes) {
      durations.push(note.duration);
    }
  }
  if (durations.length === 0) return 0;

  durations.sort((a, b) => a - b);
  return durations[Math.floor(durations.length / 2)];
}

/**
 * Detect staccato notes: notes whose duration is less than 50% of the median duration.
 *
 * @param notes - Notes from a single track
 * @param medianDuration - Pre-computed median duration across all tracks
 */
export function detectStaccato(
  notes: ParsedNote[],
  medianDuration: number,
): ExpressionMarking[] {
  if (medianDuration <= 0) return [];

  const threshold = medianDuration * STACCATO_RATIO;
  const expressions: ExpressionMarking[] = [];

  for (const note of notes) {
    if (note.duration > 0 && note.duration < threshold) {
      expressions.push({ time: note.time, type: "staccato" });
    }
  }

  return expressions;
}

/**
 * Detect legato passages: consecutive notes in the same track where note N
 * overlaps with note N+1 by more than 10ms.
 *
 * @param notes - Notes from a single track (should already be sorted by time)
 */
export function detectLegato(notes: ParsedNote[]): ExpressionMarking[] {
  const expressions: ExpressionMarking[] = [];

  for (let i = 0; i + 1 < notes.length; i++) {
    const note = notes[i];
    const next = notes[i + 1];
    const noteEnd = note.time + note.duration;

    if (noteEnd > next.time + LEGATO_OVERLAP_THRESHOLD) {
      expressions.push({ time: note.time, type: "legato" });
    }
  }

  return expressions;
}

/**
 * Deduplicate expression markings: remove nearby markings of the same type
 * within a 0.5-second window. Assumes input is sorted by time.
 */
export function deduplicateExpressions(
  expressions: ExpressionMarking[],
): ExpressionMarking[] {
  const sorted = [...expressions].sort((a, b) => a.time - b.time);
  const deduped: ExpressionMarking[] = [];

  for (const expr of sorted) {
    const prev = deduped[deduped.length - 1];
    if (
      prev &&
      prev.type === expr.type &&
      expr.time - prev.time < DEDUP_WINDOW_SECONDS
    ) {
      continue;
    }
    deduped.push(expr);
  }

  return deduped;
}

/**
 * Analyze all expression markings from MIDI data.
 *
 * Combines tempo-based (rit./accel.), staccato, and legato detection,
 * then deduplicates nearby markings of the same type.
 *
 * @param tracks - All parsed tracks from the MIDI file
 * @param tempos - Tempo change events
 * @returns Sorted, deduplicated array of expression markings
 */
export function analyzeExpressions(
  tracks: ParsedTrack[],
  tempos: TempoEvent[],
): ExpressionMarking[] {
  const expressions: ExpressionMarking[] = [];

  // Tempo-based expressions
  expressions.push(...detectTempoExpressions(tempos));

  // Per-track articulation detection
  const medianDuration = computeMedianDuration(tracks);

  for (const track of tracks) {
    expressions.push(...detectStaccato(track.notes, medianDuration));
    expressions.push(...detectLegato(track.notes));
  }

  return deduplicateExpressions(expressions);
}
