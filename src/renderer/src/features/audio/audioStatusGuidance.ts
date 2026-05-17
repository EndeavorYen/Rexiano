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

export type AudioFailureSource = "audio-context" | "soundfont" | "unknown";

export type AudioRecoveryActionId =
  | "retry-audio-context"
  | "reload-soundfont"
  | "use-synth-fallback";

export interface AudioRecoveryAction {
  id: AudioRecoveryActionId;
  label: string;
  priority: "primary" | "secondary";
}

export interface AudioStatusGuidanceInput {
  audioStatus: AudioEngineStatus;
  recoveryState: AudioRecoveryState;
  attempt: number;
  maxAttempts: number;
  successVisible: boolean;
  failureSource?: AudioFailureSource;
}

export interface AudioStatusGuidance {
  title: string;
  guidance: string;
  kind: AudioStatusGuidanceKind;
  canRetry: boolean;
  actions: AudioRecoveryAction[];
}

function buildAudioRecoveryActions(
  failureSource: AudioFailureSource | undefined,
  t: Translate,
): AudioRecoveryAction[] {
  if (failureSource === "soundfont") {
    return [
      {
        id: "reload-soundfont",
        label: t("audio.reloadSoundFont"),
        priority: "primary",
      },
      {
        id: "use-synth-fallback",
        label: t("audio.useSynthFallback"),
        priority: "secondary",
      },
    ];
  }

  return [
    {
      id: "retry-audio-context",
      label: t("audio.retry"),
      priority: "primary",
    },
  ];
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
      actions: [],
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
      actions: buildAudioRecoveryActions(input.failureSource, t),
    };
  }

  if (input.audioStatus === "loading") {
    return {
      title: t("audio.loadingTitle"),
      guidance: t("audio.loadingGuidance"),
      kind: "loading",
      canRetry: false,
      actions: [],
    };
  }

  if (input.audioStatus === "error") {
    return {
      title: t("audio.errorTitle"),
      guidance: t("audio.errorGuidance"),
      kind: "error",
      canRetry: true,
      actions: buildAudioRecoveryActions(input.failureSource, t),
    };
  }

  if (input.successVisible) {
    return {
      title: t("audio.restored"),
      guidance: t("audio.restoredGuidance"),
      kind: "restored",
      canRetry: false,
      actions: [],
    };
  }

  return null;
}
