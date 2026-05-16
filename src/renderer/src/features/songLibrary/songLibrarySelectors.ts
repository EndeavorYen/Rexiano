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
