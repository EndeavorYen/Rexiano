import { useMemo } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
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
}

export interface UsePracticeInsightsResult {
  songId: string;
  nextPracticeAction?: NextPracticeAction;
}

export function usePracticeInsights({
  song,
  displayScore,
  mode,
  speed,
}: UsePracticeInsightsOptions): UsePracticeInsightsResult {
  const songId = song?.fileName ?? "";

  const nextPracticeAction = useMemo(
    () =>
      displayScore
        ? selectNextPracticeAction({ score: displayScore, mode, speed })
        : undefined,
    [displayScore, mode, speed],
  );

  return { songId, nextPracticeAction };
}
