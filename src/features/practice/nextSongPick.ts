import type { BuiltinSongMeta, SessionRecord } from "@shared/types";
import { buildLessonProgression } from "../songLibrary/lessonProgression";
import { buildSongActivity } from "../songLibrary/songLibrarySelectors";

/**
 * The song a three-star child moves on to: the next unfinished station of the
 * lesson route, counting the run that just ended (its session may not be
 * saved yet). Null for imported songs and when the route has no station left,
 * so the result card falls back to "play again".
 */
export function pickNextSong({
  songs,
  sessions,
  currentSongName,
  accuracy,
}: {
  songs: BuiltinSongMeta[];
  sessions: SessionRecord[];
  /** `ParsedSong.fileName`, which for built-ins is the song title */
  currentSongName: string;
  accuracy: number;
}): BuiltinSongMeta | null {
  const current = songs.find(
    (entry) => entry.title === currentSongName || entry.id === currentSongName,
  );
  if (!current) return null;

  const activity = buildSongActivity(songs, sessions, [], []);
  const own = activity.get(current.id);
  if (own) {
    own.bestAccuracy = Math.max(own.bestAccuracy ?? 0, accuracy);
  }
  const next = buildLessonProgression(songs, activity).nextLesson?.song;
  return next && next.id !== current.id ? next : null;
}
