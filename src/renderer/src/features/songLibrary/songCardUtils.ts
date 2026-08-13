import type { BuiltinSongMeta } from "../../../../shared/types";
import type { TranslationKey } from "@renderer/i18n/types";

/** Tooltip descriptions explaining each difficulty level */
export const difficultyDescriptionKeys: Record<
  BuiltinSongMeta["difficulty"],
  TranslationKey
> = {
  beginner: "library.difficultyDescription.beginner",
  intermediate: "library.difficultyDescription.intermediate",
  advanced: "library.difficultyDescription.advanced",
};

/** Short label for each grade level */
export const gradeLabelShort: Record<number, string> = {
  0: "L0",
  1: "L1",
  2: "L2",
  3: "L3",
  4: "L4",
  5: "L5",
  6: "L6",
  7: "L7",
  8: "L8",
};

/** Tooltip description for each grade level */
export const gradeDescriptionKeys: Record<number, TranslationKey> = {
  0: "library.gradeDescription.0",
  1: "library.gradeDescription.1",
  2: "library.gradeDescription.2",
  3: "library.gradeDescription.3",
  4: "library.gradeDescription.4",
  5: "library.gradeDescription.5",
  6: "library.gradeDescription.6",
  7: "library.gradeDescription.7",
  8: "library.gradeDescription.8",
};

/**
 * Returns an accent color for the grade badge.
 * Green family for L0-L2, amber for L3-L4, orange for L5-L6, red for L7-L8.
 */
export function getGradeColor(grade: number): string {
  if (grade <= 2) return "#22c55e"; // green
  if (grade <= 4) return "#f59e0b"; // amber
  if (grade <= 6) return "#f97316"; // orange
  return "#ef4444"; // red
}

/** Determine the color for a best-score badge based on accuracy */
export function getBestScoreColor(accuracy: number): string {
  if (accuracy >= 90) return "#22c55e"; // green
  if (accuracy >= 70) return "var(--color-accent)";
  return "var(--color-text-secondary)";
}

// ─── Category grouping ──────────────────────────────────────────────

/** The four song categories in display order */
export type SongCategory = NonNullable<BuiltinSongMeta["category"]>;

/** Ordered list of categories for display */
export const CATEGORY_ORDER: SongCategory[] = [
  "exercise",
  "popular",
  "holiday",
  "classical",
];

/** Human-readable labels for each category */
export const categoryLabelKeys: Record<SongCategory, TranslationKey> = {
  exercise: "library.category.exercise",
  popular: "library.category.popular",
  holiday: "library.category.holiday",
  classical: "library.category.classical",
};

/** A category group with its songs */
export interface CategoryGroup {
  category: SongCategory;
  labelKey: TranslationKey;
  songs: BuiltinSongMeta[];
}

/**
 * Group songs by category in the canonical display order.
 *
 * Songs without a category are placed under "popular" by default.
 * Empty categories are omitted from the result.
 */
export function groupSongsByCategory(
  songs: BuiltinSongMeta[],
): CategoryGroup[] {
  const buckets = new Map<SongCategory, BuiltinSongMeta[]>();

  // Initialize buckets in display order
  for (const cat of CATEGORY_ORDER) {
    buckets.set(cat, []);
  }

  for (const song of songs) {
    const cat: SongCategory = song.category ?? "popular";
    const bucket = buckets.get(cat);
    if (bucket) {
      bucket.push(song);
    } else {
      // Unknown category — fall back to popular
      buckets.get("popular")!.push(song);
    }
  }

  // Build result, omitting empty categories
  const result: CategoryGroup[] = [];
  for (const cat of CATEGORY_ORDER) {
    const catSongs = buckets.get(cat)!;
    if (catSongs.length > 0) {
      result.push({
        category: cat,
        labelKey: categoryLabelKeys[cat],
        songs: catSongs,
      });
    }
  }

  return result;
}
