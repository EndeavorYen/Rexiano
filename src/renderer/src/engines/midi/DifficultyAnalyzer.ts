import type { ParsedSong } from "./types";

export interface DifficultyFactors {
  /** Notes per second across all tracks */
  noteDensity: number;
  /** Pitch span in semitones (max MIDI - min MIDI) */
  pitchRange: number;
  /** Count of unique note durations (quantized to nearest 50ms) */
  rhythmComplexity: number;
  /** Average BPM from song tempos */
  tempo: number;
  /** Overlap ratio between tracks (0 = independent, 1 = fully overlapping) */
  handIndependence: number;
}

/**
 * Normalize a value to 0-1 range using a sigmoid-like mapping.
 * `mid` is the value that maps to 0.5; `steepness` controls curve shape.
 */
function normalize(value: number, mid: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (value - mid)));
}

/**
 * Analyze a ParsedSong and return a computed difficulty grade 0-8.
 *
 * Weights: pitchRange (0.3), noteDensity (0.25), rhythmComplexity (0.2),
 *          tempo (0.15), handIndependence (0.1).
 *
 * Each factor is normalized to 0-1 via a sigmoid curve, then the weighted
 * sum is linearly mapped to the 0-8 grade scale.
 */
export function analyzeDifficulty(song: ParsedSong): {
  grade: number;
  factors: DifficultyFactors;
} {
  const allNotes = song.tracks.flatMap((t) => t.notes);

  // Edge case: empty song
  if (allNotes.length === 0 || song.duration <= 0) {
    return {
      grade: 0,
      factors: {
        noteDensity: 0,
        pitchRange: 0,
        rhythmComplexity: 0,
        tempo: 0,
        handIndependence: 0,
      },
    };
  }

  // --- Note Density ---
  const noteDensity = allNotes.length / song.duration;

  // --- Pitch Range ---
  // Use a loop instead of Math.max(...arr) to avoid stack overflow on large arrays
  let midiMax = -Infinity;
  let midiMin = Infinity;
  for (const n of allNotes) {
    if (n.midi > midiMax) midiMax = n.midi;
    if (n.midi < midiMin) midiMin = n.midi;
  }
  const pitchRange = midiMax - midiMin;

  // --- Rhythm Complexity ---
  // Quantize durations to nearest 50ms and count unique values
  const quantized = new Set(
    allNotes.map((n) => Math.round(n.duration * 20)), // 20 = 1000/50
  );
  const rhythmComplexity = quantized.size;

  // --- Tempo ---
  let tempo: number;
  if (song.tempos.length === 0) {
    tempo = 120; // default MIDI tempo
  } else {
    // Weighted average BPM by duration of each tempo segment
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < song.tempos.length; i++) {
      const start = song.tempos[i].time;
      const end =
        i + 1 < song.tempos.length ? song.tempos[i + 1].time : song.duration;
      const segDuration = Math.max(0, end - start);
      weightedSum += song.tempos[i].bpm * segDuration;
      totalWeight += segDuration;
    }
    tempo = totalWeight > 0 ? weightedSum / totalWeight : song.tempos[0].bpm;
  }

  // --- Hand Independence ---
  let handIndependence = 0;
  const noteTracks = song.tracks.filter((t) => t.notes.length > 0);
  if (noteTracks.length >= 2) {
    // Measure temporal overlap between the two most prominent tracks
    const sorted = [...noteTracks].sort(
      (a, b) => b.notes.length - a.notes.length,
    );
    const trackA = sorted[0];
    const trackB = sorted[1];

    // Count notes in trackA that overlap in time with any note in trackB.
    // Pre-sort trackB by time and use binary search to avoid O(n*m) scan.
    const sortedB = [...trackB.notes].sort((a, b) => a.time - b.time);
    let overlapping = 0;
    for (const noteA of trackA.notes) {
      const aEnd = noteA.time + noteA.duration;
      // Binary search: find first noteB whose time >= noteA.time - maxDurationB
      // Since we only need "any overlap", scan from the first noteB that could
      // possibly overlap (noteB.time < aEnd) and stop when noteB.time >= aEnd.
      // Find first index where noteB.time + noteB.duration > noteA.time
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
    handIndependence =
      trackA.notes.length > 0 ? overlapping / trackA.notes.length : 0;
  }

  const factors: DifficultyFactors = {
    noteDensity,
    pitchRange,
    rhythmComplexity,
    tempo,
    handIndependence,
  };

  // --- Normalize each factor to 0-1 ---
  const nDensity = normalize(noteDensity, 4, 0.6); // 4 nps = medium
  const nRange = normalize(pitchRange, 36, 0.08); // 3 octaves = medium
  const nRhythm = normalize(rhythmComplexity, 8, 0.3); // 8 unique durations = medium
  const nTempo = normalize(tempo, 120, 0.02); // 120 bpm = medium
  const nIndep = normalize(handIndependence, 0.5, 4); // 50% overlap = medium

  // --- Weighted sum ---
  const weightedSum =
    nRange * 0.3 +
    nDensity * 0.25 +
    nRhythm * 0.2 +
    nTempo * 0.15 +
    nIndep * 0.1;

  // Map 0-1 weighted sum to 0-8 grade, clamped
  const grade = Math.round(Math.min(8, Math.max(0, weightedSum * 8)));

  return { grade, factors };
}
