/**
 * Phase 6.5: Persisted user settings store — localStorage-backed preferences.
 * Volume is stored at 0–100 scale here; the live audio volume (0–1) lives in
 * usePlaybackStore. SettingsPanel writes to both stores to keep them in sync.
 */
import { create } from "zustand";
import type { PracticeMode } from "@shared/types";

export type Language = "en" | "zh-TW";
export type UiScale = "normal" | "large" | "xlarge";

const VALID_UI_SCALES: readonly UiScale[] = ["normal", "large", "xlarge"];

const STORAGE_KEY = "rexiano-settings";

/** Detect initial language from browser/OS setting */
function detectLanguage(): Language {
  if (typeof navigator !== "undefined") {
    const lang = navigator.language;
    if (lang.startsWith("zh")) return "zh-TW";
  }
  return "en";
}

interface SettingsState {
  showNoteLabels: boolean;
  showFallingNoteLabels: boolean;
  showFingering: boolean;
  compactKeyLabels: boolean;
  language: Language;
  /**
   * Persisted default volume (0-100 scale). Used to initialize playback volume
   * on app startup. The **live** volume used by the audio engine is in
   * `usePlaybackStore.volume` (0-1 scale). SettingsPanel writes to both stores
   * so they stay in sync, but the audio engine only reads from usePlaybackStore.
   */
  volume: number;
  /**
   * Persisted muted flag. The live mute state is derived from
   * `usePlaybackStore.volume === 0`. This field is persisted so the muted
   * preference survives app restarts.
   */
  muted: boolean;
  defaultSpeed: number;
  defaultMode: PracticeMode;
  metronomeEnabled: boolean;
  countInBeats: number;
  latencyCompensation: number;
  audioCompatibilityMode: boolean;
  noteReleaseMs: number;
  uiScale: UiScale;

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
  setNoteReleaseMs: (ms: number) => void;
  setUiScale: (scale: UiScale) => void;
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
  noteReleaseMs?: number;
  uiScale?: UiScale;
}

const defaults: PersistedSettings = {
  showNoteLabels: true,
  showFallingNoteLabels: true,
  showFingering: true,
  compactKeyLabels: false,
  language: detectLanguage(),
  volume: 80,
  muted: false,
  defaultSpeed: 1.0,
  defaultMode: "watch",
  metronomeEnabled: false,
  countInBeats: 4,
  latencyCompensation: 0,
  audioCompatibilityMode: false,
  noteReleaseMs: 150,
  uiScale: "normal",
};

function loadSavedSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedSettings;
      return { ...defaults, ...parsed };
    }
  } catch {
    // localStorage might not be available
  }
  return { ...defaults };
}

function persist(patch: Partial<PersistedSettings>): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current = raw ? (JSON.parse(raw) as PersistedSettings) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // localStorage might not be available
  }
}

export const useSettingsStore = create<SettingsState>()((set) => {
  const saved = loadSavedSettings();

  return {
    showNoteLabels: saved.showNoteLabels ?? defaults.showNoteLabels!,
    showFallingNoteLabels:
      saved.showFallingNoteLabels ?? defaults.showFallingNoteLabels!,
    showFingering: saved.showFingering ?? defaults.showFingering!,
    compactKeyLabels: saved.compactKeyLabels ?? defaults.compactKeyLabels!,
    language: saved.language ?? defaults.language!,
    volume: saved.volume ?? defaults.volume!,
    muted: saved.muted ?? defaults.muted!,
    defaultSpeed: saved.defaultSpeed ?? defaults.defaultSpeed!,
    defaultMode: saved.defaultMode ?? defaults.defaultMode!,
    metronomeEnabled: saved.metronomeEnabled ?? defaults.metronomeEnabled!,
    countInBeats: saved.countInBeats ?? defaults.countInBeats!,
    latencyCompensation:
      saved.latencyCompensation ?? defaults.latencyCompensation!,
    audioCompatibilityMode:
      saved.audioCompatibilityMode ?? defaults.audioCompatibilityMode!,
    noteReleaseMs: saved.noteReleaseMs ?? defaults.noteReleaseMs!,
    uiScale: VALID_UI_SCALES.includes(saved.uiScale as UiScale)
      ? (saved.uiScale as UiScale)
      : "normal",

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
      persist({ defaultMode: m });
      set({ defaultMode: m });
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
      const clamped = Math.max(0, Math.min(200, Math.round(ms)));
      persist({ latencyCompensation: clamped });
      set({ latencyCompensation: clamped });
    },
    setAudioCompatibilityMode: (v) => {
      persist({ audioCompatibilityMode: v });
      set({ audioCompatibilityMode: v });
    },
    setNoteReleaseMs: (ms) => {
      const clamped = Math.max(50, Math.min(300, Math.round(ms)));
      persist({ noteReleaseMs: clamped });
      set({ noteReleaseMs: clamped });
    },
    setUiScale: (scale) => {
      if (!VALID_UI_SCALES.includes(scale)) return;
      persist({ uiScale: scale });
      set({ uiScale: scale });
    },
  };
});
