import type { BuiltinSongMeta, RecentFile } from "@shared/types";
import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";
import type {
  DifficultyFilter,
  GradeFilter,
} from "../../stores/useSongLibraryStore";
import { MAX_STARS, starsForAccuracy, type StarCount } from "../progress/stars";
import {
  importedSongMatchesQuery,
  normalizeImportedSongPath,
  type ImportedSongRecord,
} from "./importedSongMetadata";
import {
  buildLessonProgression,
  type LessonGroupId,
} from "./lessonProgression";
import {
  filterSongsForLibrary,
  type SongActivity,
} from "./songLibrarySelectors";

export interface SongbookFilters {
  searchQuery: string;
  difficultyFilter: DifficultyFilter;
  gradeFilter: GradeFilter;
}

export type SongbookItem =
  | {
      kind: "builtin";
      id: string;
      song: BuiltinSongMeta;
      groupId: LessonGroupId;
      stars: StarCount;
      bestAccuracy: number | null;
    }
  | {
      kind: "imported";
      id: string;
      record: ImportedSongRecord;
      stars: StarCount;
      bestAccuracy: number | null;
    };

export type SongbookShelfId =
  | "continue"
  | "favorites"
  | "imported"
  | LessonGroupId;

export interface SongbookShelf {
  id: SongbookShelfId;
  /** Lesson units carry a title key; the other shelves use their own */
  titleKey: TranslationKey;
  /** One line under a lesson unit's title */
  descriptionKey?: TranslationKey;
  /** The "keep practising" shelf: bigger covers, the page's visual centre */
  featured?: boolean;
  items: SongbookItem[];
  /** Only lesson units count progress (songs at 3 stars) */
  completedCount: number | null;
  totalCount: number;
}

export type Songbook =
  | { mode: "shelves"; shelves: SongbookShelf[] }
  | { mode: "results"; items: SongbookItem[] };

export interface BuildSongbookInput {
  songs: BuiltinSongMeta[];
  importedSongs: ImportedSongRecord[];
  songActivity: Map<string, SongActivity>;
  importedActivity: Map<string, SongActivity>;
  filters: SongbookFilters;
}

function builtinItem(
  song: BuiltinSongMeta,
  groupId: LessonGroupId,
  activity: SongActivity | undefined,
): SongbookItem {
  const bestAccuracy = activity?.bestAccuracy ?? null;
  return {
    kind: "builtin",
    id: song.id,
    song,
    groupId,
    stars: starsForAccuracy(bestAccuracy),
    bestAccuracy,
  };
}

function importedItem(
  record: ImportedSongRecord,
  activity: SongActivity | undefined,
): SongbookItem {
  const bestAccuracy = activity?.bestAccuracy ?? null;
  return {
    kind: "imported",
    id: record.id,
    record,
    stars: starsForAccuracy(bestAccuracy),
    bestAccuracy,
  };
}

function isFiltering(filters: SongbookFilters): boolean {
  return (
    filters.searchQuery.trim() !== "" ||
    filters.difficultyFilter !== "all" ||
    filters.gradeFilter !== "all"
  );
}

/**
 * What the songbook page shows. At rest: "keep practising" (played, under
 * 3 stars), favourites, the child's own imports, then one shelf per lesson
 * unit. A song at 3 stars shows only on its unit shelf. With a search
 * word or a level picked: one flat list of covers, lesson order first.
 */
export function buildSongbook(input: BuildSongbookInput): Songbook {
  const { songs, importedSongs, songActivity, importedActivity, filters } =
    input;

  if (isFiltering(filters)) {
    const matchingSongs = filterSongsForLibrary(songs, filters);
    const progression = buildLessonProgression(matchingSongs, songActivity);
    const items: SongbookItem[] = progression.groups.flatMap((group) =>
      group.songs.map((entry) =>
        builtinItem(entry.song, group.id, songActivity.get(entry.song.id)),
      ),
    );
    // Imported songs have no difficulty, so a level filter leaves them out.
    if (filters.difficultyFilter === "all") {
      for (const record of importedSongs) {
        if (
          filters.gradeFilter !== "all" &&
          record.grade !== filters.gradeFilter
        )
          continue;
        if (!importedSongMatchesQuery(record, filters.searchQuery)) continue;
        items.push(importedItem(record, importedActivity.get(record.id)));
      }
    }
    return { mode: "results", items };
  }

  const progression = buildLessonProgression(songs, songActivity);
  const shelves: SongbookShelf[] = [];

  const byRecent = (a: SongbookItem, b: SongbookItem): number =>
    (songActivity.get(b.id)?.lastPlayedAt ?? 0) -
      (songActivity.get(a.id)?.lastPlayedAt ?? 0) || a.id.localeCompare(b.id);

  // Played but not yet at 3 stars: the songs worth another go.
  const keepPracticing = progression.groups
    .flatMap((group) =>
      group.songs
        .filter((entry) => entry.bestAccuracy !== null)
        .map((entry) =>
          builtinItem(entry.song, group.id, songActivity.get(entry.song.id)),
        ),
    )
    .filter((item) => item.stars < MAX_STARS)
    .sort(byRecent);
  if (keepPracticing.length > 0) {
    shelves.push({
      id: "continue",
      titleKey: "songbook.shelf.continue",
      items: keepPracticing,
      featured: true,
      completedCount: null,
      totalCount: keepPracticing.length,
    });
  }

  const favorites = progression.groups.flatMap((group) =>
    group.songs
      .filter((entry) => songActivity.get(entry.song.id)?.isFavorite === true)
      .map((entry) =>
        builtinItem(entry.song, group.id, songActivity.get(entry.song.id)),
      ),
  );
  if (favorites.length > 0) {
    shelves.push({
      id: "favorites",
      titleKey: "songbook.shelf.favorites",
      items: favorites,
      completedCount: null,
      totalCount: favorites.length,
    });
  }

  if (importedSongs.length > 0) {
    shelves.push({
      id: "imported",
      titleKey: "songbook.shelf.imported",
      items: importedSongs.map((record) =>
        importedItem(record, importedActivity.get(record.id)),
      ),
      completedCount: null,
      totalCount: importedSongs.length,
    });
  }

  for (const group of progression.groups) {
    shelves.push({
      id: group.id,
      titleKey: group.titleKey,
      descriptionKey: group.descriptionKey,
      items: group.songs.map((entry) =>
        builtinItem(entry.song, group.id, songActivity.get(entry.song.id)),
      ),
      completedCount: group.completedSongCount,
      totalCount: group.totalSongCount,
    });
  }

  return { mode: "shelves", shelves };
}

/**
 * Recent files that have no cover of their own: not a built-in song and
 * not an imported song. They stay reachable so a moved file can be cleared.
 */
export function selectLooseRecentFiles(
  recentFiles: RecentFile[],
  importedSongs: ImportedSongRecord[],
): RecentFile[] {
  const importedPaths = new Set(
    importedSongs.map((song) => normalizeImportedSongPath(song.sourcePath)),
  );
  return recentFiles.filter(
    (file) =>
      !file.path.startsWith("builtin:") &&
      !importedPaths.has(normalizeImportedSongPath(file.path)),
  );
}

/** "16 秒" or "1 分 20 秒" — the label under a cover. */
export function formatShelfDuration(
  seconds: number,
  t: (key: TranslationKey, params?: InterpolationParams) => string,
): string {
  const total = Number.isFinite(seconds) ? Math.max(1, Math.round(seconds)) : 1;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes === 0) return t("songbook.duration.seconds", { s: rest });
  return t("songbook.duration.minutes", { m: minutes, s: rest });
}
