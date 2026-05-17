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

function normalizeFailureDiagnostic(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }

  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return `${error.name} ${error.message}`.toLowerCase();
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    const message = typeof record.message === "string" ? record.message : "";

    if (name || message) {
      return `${name} ${message}`.toLowerCase();
    }
  }

  return String(error ?? "").toLowerCase();
}

export function classifyAudioFailureSource(
  error: unknown,
): AudioFailureSource {
  const diagnostic = normalizeFailureDiagnostic(error);

  if (
    diagnostic.includes("soundfont") ||
    diagnostic.includes(".sf2") ||
    diagnostic.includes("sf2") ||
    diagnostic.includes("sample buffer") ||
    diagnostic.includes("sample data")
  ) {
    return "soundfont";
  }

  if (
    diagnostic.includes("audiocontext") ||
    diagnostic.includes("audio context") ||
    diagnostic.includes("wasapi") ||
    diagnostic.includes("0x88890004") ||
    diagnostic.includes("device invalidated") ||
    diagnostic.includes("invalidstateerror") ||
    diagnostic.includes("notallowederror") ||
    diagnostic.includes("notreadableerror") ||
    diagnostic.includes("aborterror")
  ) {
    return "audio-context";
  }

  return "unknown";
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
