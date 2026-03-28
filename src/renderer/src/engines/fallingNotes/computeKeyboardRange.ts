import type { ParsedSong } from "../midi/types";

const PIANO_FIRST = 21; // A0
const PIANO_LAST = 108; // C8
// Minimum 4 octaves to maintain proportional key widths.
// At 88 keys the proportions are standard; 4 octaves (~28 white keys)
// is the narrowest range that still looks natural on a wide screen.
const MIN_OCTAVES = 4;

export interface KeyboardRange {
  firstNote: number;
  lastNote: number;
}

export function computeKeyboardRange(song: ParsedSong | null): KeyboardRange {
  if (!song) return { firstNote: PIANO_FIRST, lastNote: PIANO_LAST };

  let minMidi = Infinity;
  let maxMidi = -Infinity;

  for (const track of song.tracks) {
    for (const note of track.notes) {
      if (note.midi < minMidi) minMidi = note.midi;
      if (note.midi > maxMidi) maxMidi = note.midi;
    }
  }

  if (minMidi === Infinity)
    return { firstNote: PIANO_FIRST, lastNote: PIANO_LAST };

  // Expand to C boundaries
  let firstNote = Math.floor(minMidi / 12) * 12;
  let lastNote = Math.ceil((maxMidi + 1) / 12) * 12 - 1;

  if (lastNote - firstNote + 1 < MIN_OCTAVES * 12) {
    const center = Math.floor((minMidi + maxMidi) / 2);
    firstNote = Math.floor((center - 12) / 12) * 12;
    lastNote = firstNote + MIN_OCTAVES * 12 - 1;
  }

  // Clamp to piano range
  firstNote = Math.max(PIANO_FIRST, firstNote);
  lastNote = Math.min(PIANO_LAST, lastNote);

  return { firstNote, lastNote };
}
