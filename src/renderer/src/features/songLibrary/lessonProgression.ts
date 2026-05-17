import type { BuiltinSongMeta } from "@shared/types";
import type { SongActivity } from "./songLibrarySelectors";

export type LessonGroupId =
  | "first-notes"
  | "right-hand-melodies"
  | "first-two-hand"
  | "rhythm-and-expression"
  | "intermediate-classics";

export type LessonRecommendationReason =
  | "new-song"
  | "improve-score"
  | "continue-progress";

export interface LessonGroupDefinition {
  id: LessonGroupId;
  title: string;
  description: string;
}

export interface LessonSongProgress {
  song: BuiltinSongMeta;
  groupId: LessonGroupId;
  completed: boolean;
  bestAccuracy: number | null;
  playCount: number;
}

export interface LessonGroupProgress extends LessonGroupDefinition {
  songs: LessonSongProgress[];
  completed: boolean;
  completedSongCount: number;
  totalSongCount: number;
}

export interface LessonRecommendation {
  song: BuiltinSongMeta;
  groupId: LessonGroupId;
  reason: LessonRecommendationReason;
  bestAccuracy: number | null;
  playCount: number;
}

export interface LessonProgressionOptions {
  masteryAccuracy?: number;
}

export interface LessonProgressionModel {
  groups: LessonGroupProgress[];
  nextLesson: LessonRecommendation | null;
  masteryAccuracy: number;
  freeSelectionAvailable: true;
}

export const lessonGroupDefinitions: readonly LessonGroupDefinition[] = [
  {
    id: "first-notes",
    title: "First notes",
    description: "Very short songs and note patterns for first sessions.",
  },
  {
    id: "right-hand-melodies",
    title: "Right-hand melodies",
    description: "Single-line songs that build reading and hand confidence.",
  },
  {
    id: "first-two-hand",
    title: "First two-hand pieces",
    description: "Simple two-hand coordination without dense accompaniment.",
  },
  {
    id: "rhythm-and-expression",
    title: "Rhythm and expression",
    description: "Longer pieces with meter, phrasing, and key variety.",
  },
  {
    id: "intermediate-classics",
    title: "Intermediate classics",
    description: "Classical repertoire and higher-grade pieces.",
  },
] as const;

const lessonGroupOrder = new Map(
  lessonGroupDefinitions.map((definition, index) => [definition.id, index]),
);

function normalizedTags(song: BuiltinSongMeta): Set<string> {
  return new Set(song.tags.map((tag) => tag.trim().toLowerCase()));
}

function normalizedGrade(song: BuiltinSongMeta): number {
  if (song.grade !== undefined) return song.grade;
  if (song.difficulty === "advanced") return 7;
  if (song.difficulty === "intermediate") return 5;
  return 2;
}

export function classifySongLessonGroup(song: BuiltinSongMeta): LessonGroupId {
  const grade = normalizedGrade(song);
  const tags = normalizedTags(song);

  if (grade <= 0 || (song.category === "exercise" && grade <= 1)) {
    return "first-notes";
  }
  if (tags.has("two-hands") && grade <= 3) {
    return "first-two-hand";
  }
  if (grade <= 2) {
    return "right-hand-melodies";
  }
  if (grade <= 4 || tags.has("3-4") || tags.has("a-minor")) {
    return "rhythm-and-expression";
  }
  return "intermediate-classics";
}

function getSongActivity(
  songId: string,
  activity: Map<string, SongActivity>,
): Pick<SongActivity, "bestAccuracy" | "playCount"> {
  return activity.get(songId) ?? { bestAccuracy: null, playCount: 0 };
}

function compareLessonSongs(
  a: LessonSongProgress,
  b: LessonSongProgress,
): number {
  return (
    (a.song.grade ?? 99) - (b.song.grade ?? 99) ||
    a.song.title.localeCompare(b.song.title)
  );
}

function recommendationReason(
  progress: LessonSongProgress,
): LessonRecommendationReason {
  if (progress.playCount === 0) return "new-song";
  if (progress.bestAccuracy !== null) return "improve-score";
  return "continue-progress";
}

function buildNextLesson(
  groups: LessonGroupProgress[],
): LessonRecommendation | null {
  for (const group of groups) {
    const nextSong = group.songs.find((song) => !song.completed);
    if (!nextSong) continue;

    return {
      song: nextSong.song,
      groupId: group.id,
      reason: recommendationReason(nextSong),
      bestAccuracy: nextSong.bestAccuracy,
      playCount: nextSong.playCount,
    };
  }

  return null;
}

export function buildLessonProgression(
  songs: BuiltinSongMeta[],
  activity: Map<string, SongActivity>,
  options: LessonProgressionOptions = {},
): LessonProgressionModel {
  const masteryAccuracy = options.masteryAccuracy ?? 90;
  const songsByGroup = new Map<LessonGroupId, LessonSongProgress[]>();

  for (const song of songs) {
    const groupId = classifySongLessonGroup(song);
    const songActivity = getSongActivity(song.id, activity);
    const completed =
      songActivity.bestAccuracy !== null &&
      songActivity.bestAccuracy >= masteryAccuracy;
    const groupSongs = songsByGroup.get(groupId) ?? [];

    groupSongs.push({
      song,
      groupId,
      completed,
      bestAccuracy: songActivity.bestAccuracy,
      playCount: songActivity.playCount,
    });
    songsByGroup.set(groupId, groupSongs);
  }

  const groups = lessonGroupDefinitions
    .flatMap<LessonGroupProgress>((definition) => {
      const groupSongs = (songsByGroup.get(definition.id) ?? []).sort(
        compareLessonSongs,
      );
      if (groupSongs.length === 0) return [];

      const completedSongCount = groupSongs.filter(
        (song) => song.completed,
      ).length;

      return [
        {
          ...definition,
          songs: groupSongs,
          completed: completedSongCount === groupSongs.length,
          completedSongCount,
          totalSongCount: groupSongs.length,
        },
      ];
    })
    .sort(
      (a, b) =>
        (lessonGroupOrder.get(a.id) ?? 99) - (lessonGroupOrder.get(b.id) ?? 99),
    );

  return {
    groups,
    nextLesson: buildNextLesson(groups),
    masteryAccuracy,
    freeSelectionAvailable: true,
  };
}
