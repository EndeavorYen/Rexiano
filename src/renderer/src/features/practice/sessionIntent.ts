import type { PracticeMode } from "@shared/types";

export type PracticeSessionIntent = "practice" | "play-along";

export function mapSessionIntentToMode(
  intent: PracticeSessionIntent,
  savedMode: PracticeMode,
): PracticeMode {
  return intent === "play-along" ? "free" : savedMode;
}

export function shouldPromptForPracticeMode(
  intent: PracticeSessionIntent,
): boolean {
  return intent === "practice";
}
