import type { SessionRecord } from "@shared/types";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { SessionSummary } from "./WeakSpotAnalyzer";

function getMeasureDurationSeconds(song: ParsedSong): number | undefined {
  const bpm = song.tempos[0]?.bpm;
  const timeSignature = song.timeSignatures[0];
  if (!bpm || !timeSignature) return undefined;
  const beatSeconds = 60 / bpm;
  return (
    beatSeconds * timeSignature.numerator * (4 / timeSignature.denominator)
  );
}

export function buildSessionSummariesForSong(
  songId: string,
  sessions: SessionRecord[],
  song?: ParsedSong | null,
): SessionSummary[] {
  const measureDurationSeconds = song
    ? getMeasureDurationSeconds(song)
    : undefined;

  return sessions
    .filter((session) => session.songId === songId)
    .map((session) => ({
      songId: session.songId,
      accuracy: session.score.accuracy,
      durationMinutes: session.durationSeconds / 60,
      measureDurationSeconds,
      timestamp: session.timestamp,
      noteResults: new Map(session.noteResults ?? []),
    }));
}
