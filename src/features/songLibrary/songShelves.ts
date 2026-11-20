import type { BuiltinSongMeta, RecentFile } from "@shared/types";
import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";
import type {
  DifficultyFilter,
  GradeFilter,
} from "../../stores/useSongLibraryStore";
import { starsForAccuracy, type StarCount } from "../progress/stars";
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

export type SongbookShelfId = "played" | "imported" | LessonGroupId;

export interface SongbookShelf {
  id: SongbookShelfId;
  /** Lesson units carry a title key; "played" and "imported" use their own */
  titleKey: TranslationKey;
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
 * What the songbook page shows. At rest: a shelf of played songs, a shelf
 * of the child's own imports, then one shelf per lesson unit. With a search
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

  const played = progression.groups
    .flatMap((group) =>
      group.songs
        .filter((entry) => entry.bestAccuracy !== null)
        .map((entry) =>
          builtinItem(entry.song, group.id, songActivity.get(entry.song.id)),
        ),
    )
    .sort(
      (a, b) =>
        (songActivity.get(b.id)?.lastPlayedAt ?? 0) -
          (songActivity.get(a.id)?.lastPlayedAt ?? 0) ||
        a.id.localeCompare(b.id),
    );
  if (played.length > 0) {
    shelves.push({
      id: "played",
      titleKey: "songbook.shelf.played",
      items: played,
      completedCount: null,
      totalCount: played.length,
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
