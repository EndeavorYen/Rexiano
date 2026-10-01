/**
 * The library shows one big "play this next" entry so a child is never
 * choosing between three cards that name different songs (#307). The lesson
 * path leads; the practice recommendation only fills in once the path is
 * finished. Recently played songs stay a small list underneath.
 */
export type LibraryHeroEntry = "lesson" | "recommendation";

export function pickLibraryHeroEntry({
  nextLessonSongId,
  recommendationSongId,
}: {
  nextLessonSongId: string | null;
  recommendationSongId: string | null;
}): LibraryHeroEntry | null {
  if (nextLessonSongId) return "lesson";
  if (recommendationSongId) return "recommendation";
  return null;
}

export type DailyGoalTone = "neutral" | "progress" | "complete";

/** Before any practice today the goal is a plain note, not a warning. */
export function dailyGoalTone({
  practicedMinutes,
  isComplete,
}: {
  practicedMinutes: number;
  isComplete: boolean;
}): DailyGoalTone {
  if (isComplete) return "complete";
  return practicedMinutes > 0 ? "progress" : "neutral";
}
