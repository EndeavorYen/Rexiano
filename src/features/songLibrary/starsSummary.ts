import type { BuiltinSongMeta } from "@shared/types";
import type { TranslationKey } from "@renderer/i18n/types";
import { MAX_STARS, starsForAccuracy } from "../progress/stars";
import {
  buildLessonProgression,
  type LessonGroupId,
} from "./lessonProgression";
import type { SongActivity } from "./songLibrarySelectors";

export interface StarsSummaryUnit {
  groupId: LessonGroupId;
  titleKey: TranslationKey;
  /** Songs at three stars */
  done: number;
  total: number;
}

export interface StarsSummary {
  /** Stars earned over the built-in songs */
  earned: number;
  /** Every built-in song is worth three */
  max: number;
  units: StarsSummaryUnit[];
}

/** "My stars": the total and one line per lesson unit (built-in songs only). */
export function buildStarsSummary(
  songs: BuiltinSongMeta[],
  songActivity: Map<string, SongActivity>,
): StarsSummary {
  const progression = buildLessonProgression(songs, songActivity);
  let earned = 0;
  for (const group of progression.groups) {
    for (const entry of group.songs) {
      earned += starsForAccuracy(entry.bestAccuracy);
    }
  }
  return {
    earned,
    max: songs.length * MAX_STARS,
    units: progression.groups.map((group) => ({
      groupId: group.id,
      titleKey: group.titleKey,
      done: group.songs.filter(
        (entry) => starsForAccuracy(entry.bestAccuracy) === MAX_STARS,
      ).length,
      total: group.totalSongCount,
    })),
  };
}
