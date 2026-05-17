import type { BuiltinSongMeta, RecentFile, SessionRecord } from "@shared/types";
import type {
  DifficultyFilter,
  GradeFilter,
  SongLibrarySortMode,
} from "../../stores/useSongLibraryStore";

export interface SongLibraryFilters {
  difficultyFilter: DifficultyFilter;
  gradeFilter: GradeFilter;
  searchQuery: string;
}

export interface SongActivity {
  isFavorite: boolean;
  lastPlayedAt: number | null;
  playCount: number;
  bestAccuracy: number | null;
}

export interface PracticeSongRecommendationOptions {
  targetGrade?: BuiltinSongMeta["grade"];
  masteryAccuracy?: number;
}

export type PracticeRecommendationReason =
  | "new-song"
  | "improve-score"
  | "continue-progress";

export interface PracticeRecommendationModel {
  song: BuiltinSongMeta;
  reason: PracticeRecommendationReason;
  bestAccuracy: number | null;
  playCount: number;
  targetGrade?: BuiltinSongMeta["grade"];
}

const difficultyRank: Record<BuiltinSongMeta["difficulty"], number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesSongIdentity(
  session: SessionRecord,
  song: BuiltinSongMeta,
): boolean {
  const candidates = [song.id, song.title, song.file].map(normalize);
  return (
    candidates.includes(normalize(session.songId)) ||
    candidates.includes(normalize(session.songTitle))
  );
}

function baseActivity(isFavorite: boolean): SongActivity {
  return {
    isFavorite,
    lastPlayedAt: null,
    playCount: 0,
    bestAccuracy: null,
  };
}

function inferTargetGrade(
  songs: BuiltinSongMeta[],
  options: PracticeSongRecommendationOptions,
): BuiltinSongMeta["grade"] | undefined {
  return (
    options.targetGrade ??
    songs
      .map((song) => song.grade)
      .filter((grade): grade is NonNullable<BuiltinSongMeta["grade"]> =>
        Number.isFinite(grade),
      )
      .sort((a, b) => a - b)[0]
  );
}

function classifyRecommendationReason(
  activity: SongActivity,
  masteryAccuracy: number,
): PracticeRecommendationReason {
  if (activity.playCount === 0) return "new-song";
  if (
    activity.bestAccuracy !== null &&
    activity.bestAccuracy < masteryAccuracy
  ) {
    return "improve-score";
  }
  return "continue-progress";
}

export function filterSongsForLibrary(
  songs: BuiltinSongMeta[],
  filters: SongLibraryFilters,
): BuiltinSongMeta[] {
  const query = normalize(filters.searchQuery);

  return songs.filter((song) => {
    if (
      filters.difficultyFilter !== "all" &&
      song.difficulty !== filters.difficultyFilter
    ) {
      return false;
    }
    if (filters.gradeFilter !== "all" && song.grade !== filters.gradeFilter) {
      return false;
    }
    if (!query) return true;

    const searchable = [
      song.title,
      song.composer,
      song.category ?? "",
      song.grade !== undefined ? `l${song.grade}` : "",
      ...song.tags,
    ]
      .map(normalize)
      .join(" ");

    return searchable.includes(query);
  });
}

export function buildSongActivity(
  songs: BuiltinSongMeta[],
  sessions: SessionRecord[],
  recentFiles: RecentFile[],
  favoriteSongIds: string[],
): Map<string, SongActivity> {
  const favoriteSet = new Set(favoriteSongIds);
  const activity = new Map<string, SongActivity>();

  for (const song of songs) {
    activity.set(song.id, baseActivity(favoriteSet.has(song.id)));
  }

  for (const file of recentFiles) {
    if (!file.path.startsWith("builtin:")) continue;
    const songId = file.path.slice("builtin:".length);
    const current = activity.get(songId);
    if (!current) continue;
    current.lastPlayedAt = Math.max(current.lastPlayedAt ?? 0, file.timestamp);
    current.playCount += 1;
  }

  for (const session of sessions) {
    for (const song of songs) {
      if (!matchesSongIdentity(session, song)) continue;
      const current = activity.get(song.id);
      if (!current) continue;
      current.lastPlayedAt = Math.max(
        current.lastPlayedAt ?? 0,
        session.timestamp,
      );
      current.playCount += 1;
      current.bestAccuracy = Math.max(
        current.bestAccuracy ?? Number.NEGATIVE_INFINITY,
        session.score.accuracy,
      );
      if (current.bestAccuracy === Number.NEGATIVE_INFINITY) {
        current.bestAccuracy = null;
      }
    }
  }

  return activity;
}

export function sortSongsForLibrary(
  songs: BuiltinSongMeta[],
  activity: Map<string, SongActivity>,
  sortMode: SongLibrarySortMode,
): BuiltinSongMeta[] {
  return [...songs].sort((a, b) => {
    const aActivity = activity.get(a.id) ?? baseActivity(false);
    const bActivity = activity.get(b.id) ?? baseActivity(false);

    if (
      sortMode === "recent" &&
      aActivity.isFavorite !== bActivity.isFavorite
    ) {
      return aActivity.isFavorite ? -1 : 1;
    }

    switch (sortMode) {
      case "recent":
        return (
          (bActivity.lastPlayedAt ?? 0) - (aActivity.lastPlayedAt ?? 0) ||
          a.title.localeCompare(b.title)
        );
      case "title":
        return a.title.localeCompare(b.title);
      case "grade":
        return (
          (a.grade ?? 99) - (b.grade ?? 99) || a.title.localeCompare(b.title)
        );
      case "difficulty":
        return (
          difficultyRank[a.difficulty] - difficultyRank[b.difficulty] ||
          a.title.localeCompare(b.title)
        );
      case "bestScore":
        return (
          (bActivity.bestAccuracy ?? -1) - (aActivity.bestAccuracy ?? -1) ||
          a.title.localeCompare(b.title)
        );
      case "playCount":
        return (
          bActivity.playCount - aActivity.playCount ||
          a.title.localeCompare(b.title)
        );
      case "duration":
        return (
          a.durationSeconds - b.durationSeconds ||
          a.title.localeCompare(b.title)
        );
    }
  });
}

export function selectRecommendedPracticeSong(
  songs: BuiltinSongMeta[],
  activity: Map<string, SongActivity>,
  options: PracticeSongRecommendationOptions = {},
): BuiltinSongMeta | null {
  if (songs.length === 0) return null;

  const masteryAccuracy = options.masteryAccuracy ?? 90;
  const targetGrade = inferTargetGrade(songs, options);

  return [...songs].sort((a, b) => {
    const aActivity = activity.get(a.id) ?? baseActivity(false);
    const bActivity = activity.get(b.id) ?? baseActivity(false);
    const aMastered = (aActivity.bestAccuracy ?? 0) >= masteryAccuracy;
    const bMastered = (bActivity.bestAccuracy ?? 0) >= masteryAccuracy;
    const aGradeDistance =
      targetGrade === undefined || a.grade === undefined
        ? 99
        : Math.abs(a.grade - targetGrade);
    const bGradeDistance =
      targetGrade === undefined || b.grade === undefined
        ? 99
        : Math.abs(b.grade - targetGrade);

    return (
      Number(aMastered) - Number(bMastered) ||
      aGradeDistance - bGradeDistance ||
      (aActivity.playCount > 0 ? 1 : 0) - (bActivity.playCount > 0 ? 1 : 0) ||
      (a.grade ?? 99) - (b.grade ?? 99) ||
      a.title.localeCompare(b.title)
    );
  })[0];
}

export function buildPracticeRecommendationModel(
  songs: BuiltinSongMeta[],
  activity: Map<string, SongActivity>,
  options: PracticeSongRecommendationOptions = {},
): PracticeRecommendationModel | null {
  const song = selectRecommendedPracticeSong(songs, activity, options);
  if (!song) return null;

  const songActivity = activity.get(song.id) ?? baseActivity(false);
  const masteryAccuracy = options.masteryAccuracy ?? 90;
  const targetGrade = inferTargetGrade(songs, options);
  const baseModel = {
    song,
    reason: classifyRecommendationReason(songActivity, masteryAccuracy),
    bestAccuracy: songActivity.bestAccuracy,
    playCount: songActivity.playCount,
  } satisfies PracticeRecommendationModel;

  return targetGrade === undefined ? baseModel : { ...baseModel, targetGrade };
}
