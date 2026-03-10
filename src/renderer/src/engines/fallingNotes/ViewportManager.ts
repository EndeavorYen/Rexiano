import type { ParsedNote } from "@renderer/engines/midi/types";

export interface Viewport {
  width: number;
  height: number;
  pps: number;
  currentTime: number;
}

export function noteToScreenY(noteTime: number, vp: Viewport): number {
  const hitLineY = vp.height;
  return hitLineY - (noteTime - vp.currentTime) * vp.pps;
}

export function durationToHeight(duration: number, pps: number): number {
  return duration * pps;
}

export function getVisibleTimeRange(vp: Viewport): [number, number] {
  const windowSeconds = vp.height / vp.pps;
  const startTime = vp.currentTime;
  const endTime = vp.currentTime + windowSeconds;
  return [startTime, endTime];
}

/**
 * Filter notes to only those visible in the current viewport.
 * Pass a reusable `out` array from a render loop to avoid per-frame allocation.
 */
export function getVisibleNotes(
  notes: ParsedNote[],
  vp: Viewport,
  marginBefore = 0,
  out?: ParsedNote[],
): ParsedNote[] {
  const [startTime, endTime] = getVisibleTimeRange(vp);
  const adjustedStart = startTime - marginBefore;

  // Binary search for first note whose start time >= adjustedStart.
  // Notes are sorted by time (start), so this is a valid lower bound.
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (notes[mid].time < adjustedStart) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  const result = out ?? [];
  result.length = 0;

  // Scan backwards from `lo` to include long-sustain notes that started
  // before the viewport but are still active (time + duration > adjustedStart).
  for (let i = lo - 1; i >= 0; i--) {
    const note = notes[i];
    if (note.time + note.duration > adjustedStart) {
      result.push(note);
    }
    // Once we hit a note that started more than one viewport ago and has
    // ended, earlier notes won't be visible either (they started even earlier).
    // But duration varies, so we can't break early in general.
    // Limit the backward scan to avoid O(N) worst case.
    if (lo - i > 128) break;
  }

  for (let i = lo; i < notes.length; i++) {
    const note = notes[i];
    if (note.time > endTime) break;
    result.push(note);
  }
  return result;
}
