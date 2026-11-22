/**
 * A song's "contour" is the opening of its melody, small enough to live in
 * songs.json: flattened pairs of [midi pitch, length 1–4]. Covers draw it as
 * a miniature of the falling notes, so every cover is that song's own tune.
 */
export interface ContourSourceNote {
  midi: number;
  time: number;
  duration: number;
}

export const CONTOUR_NOTE_COUNT = 12;
const CHORD_WINDOW_SECONDS = 0.03;

/** Pick the melody (top note of each onset) from the highest-lying track. */
export function computeSongContour(
  tracks: readonly (readonly ContourSourceNote[])[],
): number[] {
  const melodyTrack = pickMelodyTrack(tracks);
  if (!melodyTrack) return [];

  const sorted = [...melodyTrack].sort(
    (a, b) => a.time - b.time || b.midi - a.midi,
  );
  const melody: ContourSourceNote[] = [];
  for (const note of sorted) {
    const previous = melody[melody.length - 1];
    if (previous && note.time - previous.time <= CHORD_WINDOW_SECONDS) {
      // Same onset: keep the top note of the chord.
      if (note.midi > previous.midi) melody[melody.length - 1] = note;
      continue;
    }
    if (melody.length === CONTOUR_NOTE_COUNT) break;
    melody.push(note);
  }
  if (melody.length === 0) return [];

  const shortest = Math.min(...melody.map((note) => note.duration));
  const unit = shortest > 0 ? shortest : 1;
  return melody.flatMap((note) => [
    note.midi,
    Math.max(1, Math.min(4, Math.round(note.duration / unit))),
  ]);
}

function pickMelodyTrack(
  tracks: readonly (readonly ContourSourceNote[])[],
): readonly ContourSourceNote[] | null {
  let best: readonly ContourSourceNote[] | null = null;
  let bestMean = -Infinity;
  for (const track of tracks) {
    if (track.length === 0) continue;
    const mean = track.reduce((sum, note) => sum + note.midi, 0) / track.length;
    if (mean > bestMean) {
      bestMean = mean;
      best = track;
    }
  }
  return best;
}

export interface ContourBar {
  /** 0 (lowest pitch in the contour) … 1 (highest) */
  pitch: number;
  /** 1–4 */
  length: number;
}

/** Decode a stored contour; a missing one falls back to a seeded pattern. */
export function contourBars(
  contour: readonly number[] | undefined,
  seed: string,
): ContourBar[] {
  const pairs: [number, number][] = [];
  if (contour && contour.length >= 4) {
    for (let i = 0; i + 1 < contour.length; i += 2) {
      pairs.push([contour[i], contour[i + 1]]);
    }
  } else {
    let state = hashSeed(seed);
    let pitch = 60 + (state % 5);
    for (let i = 0; i < CONTOUR_NOTE_COUNT; i += 1) {
      state = (state * 1103515245 + 12345) >>> 0;
      pitch += ((state >>> 16) % 5) - 2;
      pairs.push([pitch, 1 + ((state >>> 8) % 2)]);
    }
  }

  const pitches = pairs.map(([midi]) => midi);
  const low = Math.min(...pitches);
  const span = Math.max(1, Math.max(...pitches) - low);
  return pairs.map(([midi, length]) => ({
    pitch: (midi - low) / span,
    length: Math.max(1, Math.min(4, length)),
  }));
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  return hash;
}
