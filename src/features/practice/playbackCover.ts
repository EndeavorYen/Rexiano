import type { BuiltinSongMeta } from "@shared/types";
import {
  IMPORTED_SONG_COLOR,
  lessonGroupColor,
} from "../songLibrary/lessonGroupColor";
import { classifySongLessonGroup } from "../songLibrary/lessonProgression";

export interface PlaybackCover {
  contour: readonly number[] | undefined;
  seed: string;
  color: string;
}

/**
 * The cover the result card shows for the song that was just played: the
 * built-in song's own cover in its unit colour; anything imported wears the
 * family sun-yellow and has no melody to draw. Songs are matched by the same
 * rule as the title (`title === fileName`).
 */
export function playbackCover(
  fileName: string,
  builtin: readonly BuiltinSongMeta[],
): PlaybackCover {
  const hit = builtin.find((song) => song.title === fileName);
  if (!hit) {
    return { contour: undefined, seed: fileName, color: IMPORTED_SONG_COLOR };
  }
  return {
    contour: hit.contour,
    seed: hit.id,
    color: lessonGroupColor(classifySongLessonGroup(hit)),
  };
}
