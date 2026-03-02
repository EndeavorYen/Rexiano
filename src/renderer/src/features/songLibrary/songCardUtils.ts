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
export const gradeDescriptions: Record<number, string> = {
  0: "Pre-Starter — 3–5 notes, right hand only (C-E)",
  1: "Starter — 5-note position, stepwise (C-G)",
  2: "Early Beginner — full octave, light skips",
  3: "Beginner — first two-hand, simple bass notes",
  4: "Elementary — both hands, I-V-I chord bass",
  5: "Pre-Intermediate — position shifts, light accidentals",
  6: "Intermediate — arpeggios, Alberti bass, 2 accidentals",
  7: "Upper-Intermediate — wide range, complex rhythms",
  8: "Advanced — concert-level technique",
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
