import type { AudioEngineStatus } from "@renderer/engines/audio/types";
import type { AudioRecoveryState } from "@renderer/stores/usePlaybackStore";
import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";

type Translate = (key: TranslationKey, params?: InterpolationParams) => string;

export type AudioStatusGuidanceKind =
  | "loading"
  | "recovering"
  | "failed"
  | "error"
  | "restored";

export interface AudioStatusGuidanceInput {
  audioStatus: AudioEngineStatus;
  recoveryState: AudioRecoveryState;
  attempt: number;
  maxAttempts: number;
  successVisible: boolean;
}

export interface AudioStatusGuidance {
  title: string;
  guidance: string;
  kind: AudioStatusGuidanceKind;
  canRetry: boolean;
}

export function getAudioStatusGuidance(
  input: AudioStatusGuidanceInput,
  t: Translate,
): AudioStatusGuidance | null {
  if (input.recoveryState === "recovering") {
    return {
      title: t("audio.recovering", {
        attempt: input.attempt,
        max: input.maxAttempts,
      }),
      guidance: t("audio.recoveringGuidance"),
      kind: "recovering",
      canRetry: false,
    };
  }

  if (input.recoveryState === "failed") {
    return {
      title: t("audio.recoveryFailed"),
      guidance: t("audio.recoveryFailedGuidance", {
        max: input.maxAttempts,
      }),
      kind: "failed",
      canRetry: true,
    };
  }

  if (input.audioStatus === "loading") {
    return {
      title: t("audio.loadingTitle"),
      guidance: t("audio.loadingGuidance"),
      kind: "loading",
      canRetry: false,
    };
  }

  if (input.audioStatus === "error") {
    return {
      title: t("audio.errorTitle"),
      guidance: t("audio.errorGuidance"),
      kind: "error",
      canRetry: true,
    };
  }

  if (input.successVisible) {
    return {
      title: t("audio.restored"),
      guidance: t("audio.restoredGuidance"),
      kind: "restored",
      canRetry: false,
    };
  }

  return null;
}
