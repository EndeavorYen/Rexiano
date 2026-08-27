import type { PracticeMode } from "@shared/types";

export type PracticeSessionIntent = "practice" | "play-along";

export function mapSessionIntentToMode(
  intent: PracticeSessionIntent,
  savedMode: PracticeMode,
): PracticeMode {
  void intent;
  return savedMode === "wait" ? "wait" : "watch";
}

export function shouldPromptForPracticeMode(
  intent: PracticeSessionIntent,
): boolean {
  return intent === "practice";
}
