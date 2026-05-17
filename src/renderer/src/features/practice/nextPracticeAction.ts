import type { PracticeMode, PracticeScore, SessionRecord } from "@shared/types";
import type { TrackHandAssignment } from "@renderer/engines/midi/TrackHandAssignment";
import type { WeakSpot } from "@renderer/features/insights/WeakSpotAnalyzer";

export type NextPracticeActionKind =
  | "slow-down"
  | "raise-speed"
  | "repeat-once"
  | "try-other-hand"
  | "practice-weak-note"
  | "next-song";

export interface NextPracticeAction {
  kind: NextPracticeActionKind;
  priority: "high" | "medium" | "low";
  targetSpeed?: number;
  targetTracks?: number[];
  targetMidi?: number;
  targetMode: PracticeMode;
  reason:
    | "accuracy-low"
    | "strong-pass"
    | "steady-progress"
    | "other-hand-ready"
    | "weak-note-ready"
    | "song-mastered";
}

export interface NextPracticeActionInput {
  score: PracticeScore;
  mode: PracticeMode;
  speed: number;
  tracksPlayed?: number[];
  handAssignments?: Record<number, TrackHandAssignment>;
  weakSpots?: WeakSpot[];
}

export interface DailyGoalProgress {
  dayKey: string;
  practicedMinutes: number;
  targetMinutes: number;
  completionRatio: number;
  isComplete: boolean;
}

export type DailyGoalStatusKind = "not-started" | "in-progress" | "complete";

export interface DailyGoalStatus extends DailyGoalProgress {
  status: DailyGoalStatusKind;
  remainingMinutes: number;
}

export interface DailyGoalOptions {
  dayTimestamp: number;
  targetMinutes: number;
  timezoneOffsetMinutes?: number;
}

function clampSpeed(speed: number): number {
  return Math.max(0.25, Math.min(2, Math.round(speed * 100) / 100));
}

function dayKeyForTimestamp(
  timestamp: number,
  timezoneOffsetMinutes: number,
): string {
  const localTimestamp = timestamp - timezoneOffsetMinutes * 60_000;
  return new Date(localTimestamp).toISOString().slice(0, 10);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function findOtherHandTracks(input: NextPracticeActionInput): number[] {
  if (!input.tracksPlayed || !input.handAssignments) return [];

  const playedHands = new Set<TrackHandAssignment>();
  for (const trackIndex of input.tracksPlayed) {
    const hand = input.handAssignments[trackIndex];
    if (hand === "left" || hand === "right") {
      playedHands.add(hand);
    }
  }
  if (playedHands.size !== 1) return [];

  const [playedHand] = Array.from(playedHands);
  const nextHand = playedHand === "right" ? "left" : "right";

  return Object.entries(input.handAssignments)
    .filter(([, hand]) => hand === nextHand)
    .map(([trackIndex]) => Number(trackIndex))
    .filter((trackIndex) => Number.isInteger(trackIndex) && trackIndex >= 0)
    .sort((a, b) => a - b);
}

function findWeakestNote(input: NextPracticeActionInput): WeakSpot | null {
  if (!input.weakSpots || input.weakSpots.length === 0) return null;
  return [...input.weakSpots].sort(
    (a, b) =>
      b.missRate - a.missRate ||
      b.totalAttempts - a.totalAttempts ||
      a.midi - b.midi,
  )[0];
}

export function selectNextPracticeAction(
  input: NextPracticeActionInput,
): NextPracticeAction {
  if (input.score.totalNotes > 0 && input.score.accuracy < 70) {
    return {
      kind: "slow-down",
      priority: "high",
      targetSpeed: clampSpeed(input.speed - 0.25),
      targetMode: "wait",
      reason: "accuracy-low",
    };
  }

  if (input.score.accuracy >= 95 && input.speed < 1) {
    return {
      kind: "raise-speed",
      priority: "medium",
      targetSpeed: clampSpeed(input.speed + 0.25),
      targetMode: input.mode,
      reason: "strong-pass",
    };
  }

  if (input.score.accuracy >= 85) {
    const weakSpot = findWeakestNote(input);
    if (weakSpot) {
      return {
        kind: "practice-weak-note",
        priority: "medium",
        targetMidi: weakSpot.midi,
        targetMode: input.mode,
        reason: "weak-note-ready",
      };
    }

    const targetTracks = findOtherHandTracks(input);
    if (targetTracks.length > 0) {
      return {
        kind: "try-other-hand",
        priority: "medium",
        targetTracks,
        targetMode: input.mode,
        reason: "other-hand-ready",
      };
    }
  }

  if (
    input.score.totalNotes > 0 &&
    input.score.accuracy >= 95 &&
    input.speed >= 1
  ) {
    return {
      kind: "next-song",
      priority: "low",
      targetMode: input.mode,
      reason: "song-mastered",
    };
  }

  return {
    kind: "repeat-once",
    priority: "low",
    targetMode: input.mode,
    reason: "steady-progress",
  };
}

export function computeDailyGoalProgress(
  sessions: SessionRecord[],
  options: DailyGoalOptions,
): DailyGoalProgress {
  const timezoneOffsetMinutes =
    options.timezoneOffsetMinutes ?? new Date().getTimezoneOffset();
  const dayKey = dayKeyForTimestamp(
    options.dayTimestamp,
    timezoneOffsetMinutes,
  );
  const practicedMinutes = roundTo(
    sessions
      .filter(
        (session) =>
          dayKeyForTimestamp(session.timestamp, timezoneOffsetMinutes) ===
          dayKey,
      )
      .reduce((sum, session) => sum + session.durationSeconds, 0) / 60,
    1,
  );
  const completionRatio =
    options.targetMinutes <= 0
      ? 1
      : Math.min(1, roundTo(practicedMinutes / options.targetMinutes, 2));

  return {
    dayKey,
    practicedMinutes,
    targetMinutes: options.targetMinutes,
    completionRatio,
    isComplete: completionRatio >= 1,
  };
}

export function buildDailyGoalStatus(
  sessions: SessionRecord[],
  options: DailyGoalOptions,
): DailyGoalStatus {
  const progress = computeDailyGoalProgress(sessions, options);
  const remainingMinutes = progress.isComplete
    ? 0
    : roundTo(
        Math.max(0, progress.targetMinutes - progress.practicedMinutes),
        1,
      );
  const status: DailyGoalStatusKind = progress.isComplete
    ? "complete"
    : progress.practicedMinutes > 0
      ? "in-progress"
      : "not-started";

  return {
    ...progress,
    status,
    remainingMinutes,
  };
}
