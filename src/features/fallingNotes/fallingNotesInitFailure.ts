import type { TranslationKey } from "@renderer/i18n/types";

export interface FallingNotesInitFailure {
  titleKey: TranslationKey;
  guidanceKey: TranslationKey;
  detail: string;
}

export function describeFallingNotesInitFailure(
  error: unknown,
): FallingNotesInitFailure {
  return {
    titleKey: "fallingNotes.renderFailureTitle",
    guidanceKey: "fallingNotes.renderFailureGuidance",
    detail:
      error instanceof Error && error.message.trim()
        ? error.message
        : "Renderer initialization failed.",
  };
}
