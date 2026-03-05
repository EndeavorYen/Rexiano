import type { NotationNote } from "./types";

export interface ChordGroup {
  keys: string[];
  duration: string;
  startTick: number;
  durationTicks: number;
  notes: NotationNote[];
}

function normalizeVexKey(vexKey: string): string {
  return vexKey.trim().toLowerCase();
}

/**
 * Group notes into chords only when start tick and duration are identical.
 * This avoids incorrectly extending short notes to the longest duration.
 */
export function groupNotesIntoChords(notes: NotationNote[]): ChordGroup[] {
  if (notes.length === 0) return [];

  const sorted = [...notes].sort(
    (a, b) =>
      a.startTick - b.startTick ||
      a.durationTicks - b.durationTicks ||
      a.midi - b.midi,
  );
  const groups: ChordGroup[] = [];

  for (const note of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.startTick === note.startTick &&
      last.durationTicks === note.durationTicks
    ) {
      last.keys.push(note.vexKey);
      last.notes.push(note);
    } else {
      groups.push({
        keys: [note.vexKey],
        duration: note.vexDuration,
        startTick: note.startTick,
        durationTicks: note.durationTicks,
        notes: [note],
      });
    }
  }

  return groups;
}

interface TieIndexMapping {
  targetChordIndex: number;
  firstIndexes: number[];
  lastIndexes: number[];
}

/**
 * Build tie index mapping by matching pitch keys, not raw note index order.
 */
export function buildTieIndexMapping(
  sourceChord: ChordGroup,
  targetChords: ChordGroup[],
): TieIndexMapping | null {
  const tiedKeys = Array.from(
    new Set(
      sourceChord.notes
        .filter((n) => n.tied && !n.isRest)
        .map((n) => normalizeVexKey(n.vexKey)),
    ),
  );
  if (tiedKeys.length === 0) return null;

  for (
    let targetChordIndex = 0;
    targetChordIndex < targetChords.length;
    targetChordIndex++
  ) {
    const target = targetChords[targetChordIndex];
    if (target.startTick !== 0) continue;

    const firstIndexes: number[] = [];
    const lastIndexes: number[] = [];
    for (const key of tiedKeys) {
      const firstIdx = sourceChord.keys.findIndex(
        (k) => normalizeVexKey(k) === key,
      );
      const lastIdx = target.keys.findIndex((k) => normalizeVexKey(k) === key);
      if (firstIdx >= 0 && lastIdx >= 0) {
        firstIndexes.push(firstIdx);
        lastIndexes.push(lastIdx);
      }
    }

    if (firstIndexes.length > 0) {
      return { targetChordIndex, firstIndexes, lastIndexes };
    }
  }

  return null;
}

export function buildContinuationKeySet(
  currentNotes: NotationNote[],
  previousNotes?: NotationNote[],
): Set<string> {
  if (!previousNotes || previousNotes.length === 0) return new Set();

  const previousTiedKeys = new Set(
    previousNotes
      .filter((n) => !n.isRest && n.tied)
      .map((n) => normalizeVexKey(n.vexKey)),
  );

  const currentStartKeys = currentNotes
    .filter((n) => !n.isRest && n.startTick === 0)
    .map((n) => normalizeVexKey(n.vexKey));

  return new Set(currentStartKeys.filter((key) => previousTiedKeys.has(key)));
}

export function isContinuationKey(
  key: string,
  continuationKeys?: Set<string>,
): boolean {
  if (!continuationKeys) return false;
  return continuationKeys.has(normalizeVexKey(key));
}

/**
 * Convert an absolute tick position in a measure to a normalized 0..1000 key.
 * Used to align expression marks (beat-based) with note/chord start ticks.
 */
export function normalizeTickInMeasure(
  startTick: number,
  ticksPerQuarter: number,
  timeSignatureTop: number,
  timeSignatureBottom: number,
): number {
  const safeTop = Math.max(1, timeSignatureTop);
  const safeBottom = Math.max(1, timeSignatureBottom);
  const totalTicks = ticksPerQuarter * safeTop * (4 / safeBottom);
  if (totalTicks <= 0) return 0;

  const ratio = Math.max(0, Math.min(1, startTick / totalTicks));
  return Math.round(ratio * 1000);
}
