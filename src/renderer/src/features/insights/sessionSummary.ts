import type { SessionRecord } from "@shared/types";
import type { SessionSummary } from "./WeakSpotAnalyzer";

export function buildSessionSummariesForSong(
  songId: string,
  sessions: SessionRecord[],
): SessionSummary[] {
  return sessions
    .filter((session) => session.songId === songId)
    .map((session) => ({
      songId: session.songId,
      accuracy: session.score.accuracy,
      durationMinutes: session.durationSeconds / 60,
      timestamp: session.timestamp,
      noteResults: new Map(session.noteResults ?? []),
    }));
}
