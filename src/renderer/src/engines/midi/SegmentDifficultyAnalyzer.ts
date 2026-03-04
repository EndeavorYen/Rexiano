import type { ParsedSong, ParsedNote } from "./types";

/** Difficulty analysis for a single time segment of a song */
export interface SegmentDifficulty {
  /** Start time in seconds */
  startTime: number;
  /** End time in seconds */
  endTime: number;
  /** Normalized difficulty score (0 = trivial, 1 = extremely hard) */
  difficulty: number;
}

/**
 * Analyze a song by dividing it into fixed-duration segments and computing
 * a difficulty score for each one.
 *
 * The score is a weighted combination of:
 * - Note density (notes per second) — weight 0.45
 * - Average interval size (semitones between consecutive notes) — weight 0.30
 * - Hand independence (rhythmic divergence between tracks) — weight 0.25
 *
 * Each metric is normalized to 0-1 via a sigmoid curve, then combined.
 *
 * @param song - The parsed MIDI song
 * @param segmentDurationSec - Width of each segment in seconds (default 2)
 * @returns Array of per-segment difficulty scores, ordered chronologically
 */
export function analyzeSegments(
  song: ParsedSong,
  segmentDurationSec: number = 2,
): SegmentDifficulty[] {
  if (
    !song ||
    song.duration <= 0 ||
    song.tracks.length === 0 ||
    segmentDurationSec <= 0
  ) {
    return [];
  }

  const allNotes = song.tracks.flatMap((t) => t.notes);
  if (allNotes.length === 0) return [];

  const segmentCount = Math.ceil(song.duration / segmentDurationSec);
  const segments: SegmentDifficulty[] = [];

  // Pre-sort all notes by time for efficient slicing
  const sortedNotes = [...allNotes].sort((a, b) => a.time - b.time);

  // Identify the two most prominent tracks for hand independence
  const noteTracks = song.tracks.filter((t) => t.notes.length > 0);
  const sortedTracks = [...noteTracks].sort(
    (a, b) => b.notes.length - a.notes.length,
  );
  const hasMultipleTracks = sortedTracks.length >= 2;

  for (let i = 0; i < segmentCount; i++) {
    const startTime = i * segmentDurationSec;
    const endTime = Math.min((i + 1) * segmentDurationSec, song.duration);
    const windowDuration = endTime - startTime;

    if (windowDuration <= 0) continue;

    // Collect notes that start within this segment
    const segmentNotes = getNotesInWindow(sortedNotes, startTime, endTime);

    if (segmentNotes.length === 0) {
      segments.push({ startTime, endTime, difficulty: 0 });
      continue;
    }

    // --- Note density (notes per second) ---
    const density = segmentNotes.length / windowDuration;
    const nDensity = sigmoid(density, 6, 0.5);

    // --- Average interval size ---
    const avgInterval = computeAverageInterval(segmentNotes);
    const nInterval = sigmoid(avgInterval, 7, 0.3);

    // --- Hand independence ---
    let nIndependence = 0;
    if (hasMultipleTracks) {
      const trackANotes = getNotesInWindow(
        sortedTracks[0].notes,
        startTime,
        endTime,
      );
      const trackBNotes = getNotesInWindow(
        sortedTracks[1].notes,
        startTime,
        endTime,
      );
      const independence = computeHandIndependence(trackANotes, trackBNotes);
      nIndependence = sigmoid(independence, 0.5, 4);
    }

    // Weighted combination
    const difficulty = Math.min(
      1,
      Math.max(0, nDensity * 0.45 + nInterval * 0.3 + nIndependence * 0.25),
    );

    segments.push({ startTime, endTime, difficulty });
  }

  return segments;
}

/**
 * Sigmoid normalization: maps a value to 0-1 range.
 * `mid` is the value that maps to 0.5; `steepness` controls curve shape.
 */
function sigmoid(value: number, mid: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (value - mid)));
}

/** Get notes whose start time falls within [start, end) */
function getNotesInWindow(
  notes: ParsedNote[],
  start: number,
  end: number,
): ParsedNote[] {
  // Binary search for first note >= start
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid].time < start) lo = mid + 1;
    else hi = mid;
  }
  const result: ParsedNote[] = [];
  for (let i = lo; i < notes.length && notes[i].time < end; i++) {
    result.push(notes[i]);
  }
  return result;
}

/**
 * Compute the average absolute interval (in semitones) between consecutive
 * notes, sorted by time then pitch.
 */
function computeAverageInterval(notes: ParsedNote[]): number {
  if (notes.length < 2) return 0;

  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
  let totalInterval = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalInterval += Math.abs(sorted[i].midi - sorted[i - 1].midi);
  }
  return totalInterval / (sorted.length - 1);
}

/**
 * Compute hand independence as the ratio of notes in track A that overlap
 * temporally with any note in track B. Higher overlap = more independence required.
 */
function computeHandIndependence(
  trackANotes: ParsedNote[],
  trackBNotes: ParsedNote[],
): number {
  if (trackANotes.length === 0 || trackBNotes.length === 0) return 0;

  // Pre-sort trackB by time and use binary search to avoid O(n*m) scan.
  const sortedB = [...trackBNotes].sort((a, b) => a.time - b.time);
  let overlapping = 0;
  for (const noteA of trackANotes) {
    const aEnd = noteA.time + noteA.duration;
    // Binary search: find first noteB whose end time > noteA.time
    let lo = 0;
    let hi = sortedB.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sortedB[mid].time + sortedB[mid].duration <= noteA.time) lo = mid + 1;
      else hi = mid;
    }
    for (let j = lo; j < sortedB.length; j++) {
      const noteB = sortedB[j];
      if (noteB.time >= aEnd) break; // no more possible overlaps
      const bEnd = noteB.time + noteB.duration;
      if (noteA.time < bEnd && noteB.time < aEnd) {
        overlapping++;
        break;
      }
    }
  }
  return trackANotes.length > 0 ? overlapping / trackANotes.length : 0;
}
