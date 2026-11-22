import type { LessonGroupId } from "./lessonProgression";

/**
 * One color per lesson unit, used by the map's regions and by song covers
 * so a child learns "orange = right-hand melodies" once.
 */
const GROUP_COLOR_VAR: Record<LessonGroupId, string> = {
  "first-notes": "var(--color-note1)",
  "right-hand-melodies": "var(--color-note2)",
  "first-two-hand": "var(--color-note3)",
  "rhythm-and-expression": "var(--color-note4)",
  "intermediate-classics": "var(--color-unit5)",
};

export function lessonGroupColor(groupId: LessonGroupId): string {
  return GROUP_COLOR_VAR[groupId];
}

/** Imported songs have no unit; they wear the family sun-yellow. */
export const IMPORTED_SONG_COLOR = "var(--color-accent)";
