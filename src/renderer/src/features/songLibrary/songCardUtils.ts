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
export const categoryLabels: Record<SongCategory, string> = {
  exercise: "Exercises",
  popular: "Popular",
  holiday: "Holiday",
  classical: "Classical",
};

/** A category group with its songs */
export interface CategoryGroup {
  category: SongCategory;
  label: string;
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
        label: categoryLabels[cat],
        songs: catSongs,
      });
    }
  }

  return result;
}
