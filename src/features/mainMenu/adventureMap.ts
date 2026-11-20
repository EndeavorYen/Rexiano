import type { BuiltinSongMeta } from "@shared/types";
import { MAX_STARS, starsForAccuracy, type StarCount } from "../progress/stars";
import type {
  LessonGroupId,
  LessonGroupProgress,
  LessonProgressionModel,
} from "../songLibrary/lessonProgression";

/** done = 3 stars, played = 1–2 stars, next = the one to play now, new = never played */
export type StationStatus = "done" | "played" | "next" | "new";

export interface MapStation {
  song: BuiltinSongMeta;
  groupId: LessonGroupId;
  /** Position along the whole route (0-based) */
  index: number;
  stars: StarCount;
  status: StationStatus;
  bestAccuracy: number | null;
  playCount: number;
}

export interface MapRegion {
  groupId: LessonGroupId;
  group: LessonGroupProgress;
  stations: MapStation[];
  /** Index of the region's first station on the route */
  firstIndex: number;
  completedCount: number;
  totalCount: number;
}

export interface AdventureMapModel {
  regions: MapRegion[];
  stations: MapStation[];
  nextStation: MapStation | null;
  totalStars: number;
  maxStars: number;
  /** True once any built-in song has a result */
  hasAnyProgress: boolean;
}

/** Turns the lesson progression into one flat route of stations. */
export function buildAdventureMap(
  progression: LessonProgressionModel,
): AdventureMapModel {
  const nextId = progression.nextLesson?.song.id ?? null;
  const stations: MapStation[] = [];
  const regions: MapRegion[] = [];
  let totalStars = 0;
  let hasAnyProgress = false;

  for (const group of progression.groups) {
    const firstIndex = stations.length;
    const regionStations: MapStation[] = group.songs.map((entry, offset) => {
      const stars = starsForAccuracy(entry.bestAccuracy);
      if (entry.bestAccuracy !== null) hasAnyProgress = true;
      totalStars += stars;
      const status: StationStatus =
        entry.song.id === nextId
          ? "next"
          : stars === 3
            ? "done"
            : stars > 0
              ? "played"
              : "new";
      return {
        song: entry.song,
        groupId: group.id,
        index: firstIndex + offset,
        stars,
        status,
        bestAccuracy: entry.bestAccuracy,
        playCount: entry.playCount,
      };
    });
    stations.push(...regionStations);
    regions.push({
      groupId: group.id,
      group,
      stations: regionStations,
      firstIndex,
      completedCount: group.completedSongCount,
      totalCount: group.totalSongCount,
    });
  }

  return {
    regions,
    stations,
    nextStation: stations.find((s) => s.status === "next") ?? null,
    totalStars,
    maxStars: stations.length * MAX_STARS,
    hasAnyProgress,
  };
}

/**
 * Whether the road between two neighbouring stations is drawn solid.
 * Solid means the child has been along it: a star at both ends, or a star at
 * the start of the road that leads to the next stop.
 */
export function isRoadWalked(from: MapStation, to: MapStation): boolean {
  if (from.stars === 0) return false;
  return to.stars > 0 || to.status === "next";
}
