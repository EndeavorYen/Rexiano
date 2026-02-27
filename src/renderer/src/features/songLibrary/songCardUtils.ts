import type { BuiltinSongMeta } from "../../../../shared/types";

/** Tooltip descriptions explaining each difficulty level */
export const difficultyDescriptions: Record<
  BuiltinSongMeta["difficulty"],
  string
> = {
  beginner: "Simple melodies, single hand, slow tempo",
  intermediate: "Both hands, moderate tempo, basic chords",
  advanced: "Complex rhythms, fast passages, wide range",
};

/** Determine the color for a best-score badge based on accuracy */
export function getBestScoreColor(accuracy: number): string {
  if (accuracy >= 90) return "#22c55e"; // green
  if (accuracy >= 70) return "var(--color-accent)";
  return "var(--color-text-secondary)";
}
