/**
 * "Play this one now": the note (or chord) closest to the hit line that has
 * not been played yet gets a bright frame. Pure helpers, so the renderer can
 * use them per note per frame without allocating.
 */

/** Notes whose start times are this close belong to the same chord. */
export const TARGET_GROUP_WINDOW = 0.03;

/**
 * Fold one note into the search for the next group's start time. Returns the
 * earlier of `best` and `noteTime`, but only if the note has not passed the
 * hit line (a small grace window keeps a note that is just landing).
 */
export function foldNextNoteTime(
  best: number,
  noteTime: number,
  currentTime: number,
  graceWindow: number,
): number {
  if (noteTime < currentTime - graceWindow) return best;
  return noteTime < best ? noteTime : best;
}

/** Whether a note starts with the target group. */
export function isTargetNote(noteTime: number, targetTime: number): boolean {
  return Math.abs(noteTime - targetTime) <= TARGET_GROUP_WINDOW;
}
