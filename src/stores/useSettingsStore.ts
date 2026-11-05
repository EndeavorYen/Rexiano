import { create } from "zustand";
import type { PracticeMode } from "@shared/types";
import type { SoundSource } from "@renderer/features/audio/pianoOutputPolicy";
import { USER_DATA_STORAGE_KEYS } from "@renderer/features/settings/userDataStorageKeys";

export type Language = "en" | "zh-TW";

const STORAGE_KEY = USER_DATA_STORAGE_KEYS.settings;

/** Detect initial language from browser/OS setting */
function detectLanguage(): Language {
  return "zh-TW";
}

interface SettingsState {
  showNoteLabels: boolean;
  showFallingNoteLabels: boolean;
  showFingering: boolean;
  compactKeyLabels: boolean;
  language: Language;
  volume: number;
  muted: boolean;
  defaultSpeed: number;
  defaultMode: PracticeMode;
  metronomeEnabled: boolean;
  countInBeats: number;
  latencyCompensation: number;
  audioCompatibilityMode: boolean;
  childFocusMode: boolean;
  /** Where the song sounds when a piano is connected */
  soundSource: SoundSource;
  /** Send the song this many ms early so the piano lines up with the notes */
  pianoOutputLatency: number;

  setShowNoteLabels: (v: boolean) => void;
  setShowFallingNoteLabels: (v: boolean) => void;
  setShowFingering: (v: boolean) => void;
  setCompactKeyLabels: (v: boolean) => void;
  setLanguage: (lang: Language) => void;
  setVolume: (v: number) => void;
  setMuted: (v: boolean) => void;
  setDefaultSpeed: (v: number) => void;
  setDefaultMode: (m: PracticeMode) => void;
  setMetronomeEnabled: (v: boolean) => void;
  setCountInBeats: (v: number) => void;
  setLatencyCompensation: (ms: number) => void;
  setAudioCompatibilityMode: (v: boolean) => void;
  setChildFocusMode: (v: boolean) => void;
  setSoundSource: (v: SoundSource) => void;
  setPianoOutputLatency: (ms: number) => void;
}

interface PersistedSettings {
  showNoteLabels?: boolean;
  showFallingNoteLabels?: boolean;
  showFingering?: boolean;
  compactKeyLabels?: boolean;
  language?: Language;
  volume?: number;
  muted?: boolean;
  defaultSpeed?: number;
  defaultMode?: PracticeMode;
  metronomeEnabled?: boolean;
  countInBeats?: number;
  latencyCompensation?: number;
  audioCompatibilityMode?: boolean;
  childFocusMode?: boolean;
  soundSource?: SoundSource;
  pianoOutputLatency?: number;
}

const defaults: PersistedSettings = {
  showNoteLabels: true,
  showFallingNoteLabels: true,
  showFingering: false,
  compactKeyLabels: false,
  language: detectLanguage(),
  volume: 80,
  muted: false,
  defaultSpeed: 1.0,
  defaultMode: "watch",
  metronomeEnabled: false,
  countInBeats: 0,
  latencyCompensation: 0,
  audioCompatibilityMode: false,
  childFocusMode: false,
  soundSource: "piano",
  pianoOutputLatency: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function savedBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function savedNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function savedLanguage(value: unknown, fallback: Language): Language {
  return value === "en" || value === "zh-TW" ? value : fallback;
}

function savedPracticeMode(
  value: unknown,
  fallback: PracticeMode,
): PracticeMode {
  if (value === "watch" || value === "wait") return value;
  if (value === "free") return "wait";
  return fallback;
}

export function normalizePersistedSettings(value: unknown): PersistedSettings {
  const source = isRecord(value) ? value : {};

  return {
    showNoteLabels: savedBoolean(
      source.showNoteLabels,
      defaults.showNoteLabels!,
    ),
    showFallingNoteLabels: savedBoolean(
      source.showFallingNoteLabels,
      defaults.showFallingNoteLabels!,
    ),
    showFingering: false,
    compactKeyLabels: savedBoolean(
      source.compactKeyLabels,
      defaults.compactKeyLabels!,
    ),
    language: savedLanguage(source.language, defaults.language!),
    volume: clampNumber(savedNumber(source.volume, defaults.volume!), 0, 100),
    muted: savedBoolean(source.muted, defaults.muted!),
    defaultSpeed: clampNumber(
      savedNumber(source.defaultSpeed, defaults.defaultSpeed!),
      0.25,
      2,
    ),
    defaultMode: savedPracticeMode(source.defaultMode, defaults.defaultMode!),
    metronomeEnabled: false,
    countInBeats: 0,
    latencyCompensation: Math.round(
      clampNumber(
        savedNumber(source.latencyCompensation, defaults.latencyCompensation!),
        0,
        100,
      ),
    ),
    audioCompatibilityMode: savedBoolean(
      source.audioCompatibilityMode,
      defaults.audioCompatibilityMode!,
    ),
    childFocusMode: false,
    soundSource:
      source.soundSource === "computer" || source.soundSource === "piano"
        ? source.soundSource
        : defaults.soundSource!,
    pianoOutputLatency: Math.round(
      clampNumber(
        savedNumber(source.pianoOutputLatency, defaults.pianoOutputLatency!),
        0,
        150,
      ),
    ),
  };
}

function loadSavedSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizePersistedSettings(JSON.parse(raw));
    }
  } catch {
    // localStorage might not be available
  }
  return { ...defaults };
}

function persist(patch: Partial<PersistedSettings>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw ? normalizePersistedSettings(JSON.parse(raw)) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // localStorage might not be available
  }
}

export const useSettingsStore = create<SettingsState>()((set) => {
  const saved = loadSavedSettings();

  return {
    showNoteLabels: saved.showNoteLabels!,
    showFallingNoteLabels: saved.showFallingNoteLabels!,
    showFingering: saved.showFingering!,
    compactKeyLabels: saved.compactKeyLabels!,
    language: saved.language!,
    volume: saved.volume!,
    muted: saved.muted!,
    defaultSpeed: saved.defaultSpeed!,
    defaultMode: saved.defaultMode!,
    metronomeEnabled: saved.metronomeEnabled!,
    countInBeats: saved.countInBeats!,
    latencyCompensation: saved.latencyCompensation!,
    audioCompatibilityMode: saved.audioCompatibilityMode!,
    childFocusMode: saved.childFocusMode!,
    soundSource: saved.soundSource!,
    pianoOutputLatency: saved.pianoOutputLatency!,

    setShowNoteLabels: (v) => {
      persist({ showNoteLabels: v });
      set({ showNoteLabels: v });
    },
    setShowFallingNoteLabels: (v) => {
      persist({ showFallingNoteLabels: v });
      set({ showFallingNoteLabels: v });
    },
    setShowFingering: (v) => {
      persist({ showFingering: v });
      set({ showFingering: v });
    },
    setCompactKeyLabels: (v) => {
      persist({ compactKeyLabels: v });
      set({ compactKeyLabels: v });
    },
    setLanguage: (lang) => {
      persist({ language: lang });
      set({ language: lang });
    },
    setVolume: (v) => {
      const clamped = Math.max(0, Math.min(100, v));
      persist({ volume: clamped });
      set({ volume: clamped });
    },
    setMuted: (v) => {
      persist({ muted: v });
      set({ muted: v });
    },
    setDefaultSpeed: (v) => {
      const clamped = Math.max(0.25, Math.min(2.0, v));
      persist({ defaultSpeed: clamped });
      set({ defaultSpeed: clamped });
    },
    setDefaultMode: (m) => {
      const mode = m === "free" ? "wait" : m;
      persist({ defaultMode: mode });
      set({ defaultMode: mode });
    },
    setMetronomeEnabled: (v) => {
      persist({ metronomeEnabled: v });
      set({ metronomeEnabled: v });
    },
    setCountInBeats: (v) => {
      const clamped = Math.max(0, Math.min(8, Math.round(v)));
      persist({ countInBeats: clamped });
      set({ countInBeats: clamped });
    },
    setLatencyCompensation: (ms) => {
      const clamped = Math.max(0, Math.min(100, Math.round(ms)));
      persist({ latencyCompensation: clamped });
      set({ latencyCompensation: clamped });
    },
    setAudioCompatibilityMode: (v) => {
      persist({ audioCompatibilityMode: v });
      set({ audioCompatibilityMode: v });
    },
    setChildFocusMode: (v) => {
      persist({ childFocusMode: v });
      set({ childFocusMode: v });
    },
    setSoundSource: (v) => {
      persist({ soundSource: v });
      set({ soundSource: v });
    },
    setPianoOutputLatency: (ms) => {
      const clamped = Math.max(0, Math.min(150, Math.round(ms)));
      persist({ pianoOutputLatency: clamped });
      set({ pianoOutputLatency: clamped });
    },
  };
});
