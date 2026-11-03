import type { PracticeMode } from "@shared/types";

export type PracticeSessionIntent = "practice" | "play-along";

export function mapSessionIntentToMode(
  intent: PracticeSessionIntent,
  savedMode: PracticeMode,
): PracticeMode {
  if (intent === "play-along" || savedMode === "free") return "wait";
  return savedMode;
}

export function shouldPromptForPracticeMode(
  intent: PracticeSessionIntent,
): boolean {
  return intent === "practice";
}
