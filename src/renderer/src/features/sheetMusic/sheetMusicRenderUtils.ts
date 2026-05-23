import type { NotationNote, NotationTuplet } from "./types";

export interface ChordGroup {
  keys: string[];
  accidentals: (string | null)[];
  duration: string;
  dots: number;
  startTick: number;
  durationTicks: number;
  isRest: boolean;
  tiedFromPrevious: boolean;
  tiedToNext: boolean;
  voiceIndex: number;
  stemDirection?: 1 | -1;
  tuplet?: NotationTuplet;
}

function tupletsMatch(
  a: NotationTuplet | undefined,
  b: NotationTuplet | undefined,
): boolean {
  return a?.id === b?.id;
}

/**
 * Group notes that start at the same tick into chords, but only within
 * the same staff-local voice so independent rhythms do not collapse together.
 */
export function groupNotesIntoChords(notes: NotationNote[]): ChordGroup[] {
  if (notes.length === 0) return [];

  const sorted = [...notes].sort(
    (a, b) =>
      a.startTick - b.startTick ||
      Number(a.isRest) - Number(b.isRest) ||
      (a.midi ?? -1) - (b.midi ?? -1),
  );
  const groups: ChordGroup[] = [];

  for (const note of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      !last.isRest &&
      !note.isRest &&
      last.voiceIndex === (note.voiceIndex ?? 0) &&
      last.startTick === note.startTick &&
      last.duration === note.vexDuration &&
      last.dots === note.dots &&
      tupletsMatch(last.tuplet, note.tuplet)
    ) {
      last.keys.push(note.vexKey);
      last.accidentals.push(note.accidental);
      last.durationTicks = Math.max(last.durationTicks, note.durationTicks);
      last.tiedFromPrevious ||= note.tiedFromPrevious;
      last.tiedToNext ||= note.tiedToNext;
    } else {
      groups.push({
        keys: [note.vexKey],
        accidentals: [note.accidental],
        duration: note.vexDuration,
        dots: note.dots,
        startTick: note.startTick,
        durationTicks: note.durationTicks,
        isRest: note.isRest,
        tiedFromPrevious: note.tiedFromPrevious,
        tiedToNext: note.tiedToNext,
        voiceIndex: note.voiceIndex ?? 0,
        stemDirection: note.stemDirection,
        tuplet: note.tuplet,
      });
    }
  }

  return groups;
}

export function groupNotesIntoStaffVoices(
  notes: NotationNote[],
): ChordGroup[][] {
  const voiceIndexes = [...new Set(notes.map((note) => note.voiceIndex ?? 0))]
    .filter((voiceIndex) => Number.isFinite(voiceIndex))
    .sort((a, b) => a - b);

  return voiceIndexes.map((voiceIndex) =>
    groupNotesIntoChords(
      notes.filter((note) => (note.voiceIndex ?? 0) === voiceIndex),
    ),
  );
}
