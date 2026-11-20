import type { BuiltinSongMeta } from "@shared/types";
import { buildLessonProgression } from "./lessonProgression";

/** Three base tones of a unit color, four backdrop shapes: 12 looks. */
export const COVER_TONES = 3;
export const COVER_SHAPES = 4;
const LOOKS = COVER_TONES * COVER_SHAPES;

export interface CoverStyle {
  tone: number;
  shape: number;
  /** Mirrors the backdrop left-right */
  flip: boolean;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * How a cover looks apart from its notes. Without a position it comes from
 * the song id alone. With the song's position in its unit, neighbours step
 * by 5 of 12 looks: the tone always changes and no look repeats for 12 songs.
 */
export function coverStyle(seed: string, variant?: number): CoverStyle {
  const h = hash(seed);
  const flip = ((h >>> 20) & 1) === 1;
  const look =
    variant === undefined
      ? h % LOOKS
      : (((Math.floor(variant) * 5) % LOOKS) + LOOKS) % LOOKS;
  return {
    tone: look % COVER_TONES,
    shape: Math.floor(look / COVER_TONES),
    flip,
  };
}

/** song id → position inside its lesson unit, in shelf order. */
export function coverVariantsByUnit(
  songs: BuiltinSongMeta[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const group of buildLessonProgression(songs, new Map()).groups) {
    group.songs.forEach((entry, index) => map.set(entry.song.id, index));
  }
  return map;
}
