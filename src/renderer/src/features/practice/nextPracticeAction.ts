import type { PracticeMode, PracticeScore, SessionRecord } from "@shared/types";
import type { TrackHandAssignment } from "@renderer/engines/midi/TrackHandAssignment";

export type NextPracticeActionKind =
  | "slow-down"
  | "raise-speed"
  | "repeat-once"
  | "try-other-hand";

export interface NextPracticeAction {
  kind: NextPracticeActionKind;
  priority: "high" | "medium" | "low";
  targetSpeed?: number;
  targetTracks?: number[];
  targetMode: PracticeMode;
  reason:
    | "accuracy-low"
    | "strong-pass"
    | "steady-progress"
    | "other-hand-ready";
}

export interface NextPracticeActionInput {
  score: PracticeScore;
  mode: PracticeMode;
  speed: number;
  tracksPlayed?: number[];
  handAssignments?: Record<number, TrackHandAssignment>;
}

export interface DailyGoalProgress {
  dayKey: string;
  practicedMinutes: number;
  targetMinutes: number;
  completionRatio: number;
  isComplete: boolean;
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
