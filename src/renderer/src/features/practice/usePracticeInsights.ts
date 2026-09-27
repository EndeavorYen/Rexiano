import { useMemo } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import { WeakSpotAnalyzer } from "../insights/WeakSpotAnalyzer";
import { buildSessionSummariesForSong } from "../insights/sessionSummary";
import {
  selectNextPracticeAction,
  type NextPracticeAction,
} from "./nextPracticeAction";
import type { PracticeMode, PracticeScore, SessionRecord } from "@shared/types";

const defaultAnalyzer = new WeakSpotAnalyzer();

export function computeSongInsight(
  song: ParsedSong | null,
  songId: string,
  sessions: SessionRecord[],
  analyzer: WeakSpotAnalyzer = defaultAnalyzer,
): ReturnType<WeakSpotAnalyzer["analyze"]> | null {
  if (!songId || sessions.length === 0) return null;
  const summaries = buildSessionSummariesForSong(
    songId,
    sessions,
    song ?? undefined,
  );
  return analyzer.analyze(songId, summaries);
}

export interface UsePracticeInsightsOptions {
  song: ParsedSong | null;
  displayScore: PracticeScore | null;
  mode: PracticeMode;
  speed: number;
  activeTracks: Set<number>;
}

export interface UsePracticeInsightsResult {
  songId: string;
  insight: ReturnType<WeakSpotAnalyzer["analyze"]> | null;
  nextPracticeAction?: NextPracticeAction;
}

export function usePracticeInsights({
  song,
  displayScore,
  mode,
  speed,
  activeTracks,
}: UsePracticeInsightsOptions): UsePracticeInsightsResult {
  const sessions = useProgressStore((s) => s.sessions);
  const songId = song?.fileName ?? "";

  const insight = useMemo(
    () => computeSongInsight(song, songId, sessions, defaultAnalyzer),
    [sessions, song, songId],
  );

  const nextPracticeAction = useMemo(
    () =>
      displayScore
        ? selectNextPracticeAction({
            score: displayScore,
            mode,
            speed,
            tracksPlayed: Array.from(activeTracks),
            weakSpots: insight?.weakSpots,
            weakSections: insight?.weakSections,
          })
        : undefined,
    [
      activeTracks,
      displayScore,
      insight?.weakSections,
      insight?.weakSpots,
      mode,
      speed,
    ],
  );

  return {
    songId,
    insight,
    nextPracticeAction,
  };
}
