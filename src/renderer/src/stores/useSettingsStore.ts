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
const VALID_PRACTICE_MODES: readonly PracticeMode[] = [
  "watch",
  "wait",
  "free",
  "step",
];

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
  /**
   * Persisted last non-zero volume (0-100 scale). Used as the canonical
   * restore-target when unmuting. Updated whenever volume is set to a value > 0.
   * This eliminates stale-ref issues and ensures consistent unmute behavior
   * across SettingsPanel toggles and keyboard shortcuts.
   */
  lastNonZeroVolume: number;
  defaultSpeed: number;
  defaultMode: PracticeMode;
  metronomeEnabled: boolean;
  countInBeats: number;
  latencyCompensation: number;
  audioCompatibilityMode: boolean;
  noteReleaseMs: number;
  uiScale: UiScale;
  kidMode: boolean;

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
  setKidMode: (v: boolean) => void;
}

interface PersistedSettings {
  showNoteLabels?: boolean;
  showFallingNoteLabels?: boolean;
  showFingering?: boolean;
  compactKeyLabels?: boolean;
  language?: Language;
  volume?: number;
  muted?: boolean;
  lastNonZeroVolume?: number;
  defaultSpeed?: number;
  defaultMode?: PracticeMode;
  metronomeEnabled?: boolean;
  countInBeats?: number;
  latencyCompensation?: number;
  audioCompatibilityMode?: boolean;
  noteReleaseMs?: number;
  uiScale?: UiScale;
  kidMode?: boolean;
}

const defaults: PersistedSettings = {
  showNoteLabels: true,
  showFallingNoteLabels: true,
  showFingering: true,
  compactKeyLabels: false,
  language: detectLanguage(),
  volume: 80,
  muted: false,
  lastNonZeroVolume: 80,
  defaultSpeed: 1.0,
  defaultMode: "watch",
  metronomeEnabled: false,
  countInBeats: 4,
  latencyCompensation: 0,
  audioCompatibilityMode: false,
  noteReleaseMs: 150,
  uiScale: "normal",
  kidMode: false,
};

/** Clamp a value to a valid range, falling back to a default if not a finite number. */
function clampNum(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function loadSavedSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedSettings;
      const merged = { ...defaults, ...parsed };
      // R3-02 fix: Validate numeric ranges on load — same clamping as setters.
      // Without this, corrupted localStorage can create out-of-range values
      // that bypass setter validation (setters clamp, but initial load doesn't).
      merged.volume = clampNum(merged.volume, 0, 100, defaults.volume!);
      merged.lastNonZeroVolume = clampNum(
        merged.lastNonZeroVolume,
        0,
        100,
        merged.volume,
      );
      merged.defaultSpeed = Math.max(
        0.25,
        Math.min(
          2.0,
          typeof merged.defaultSpeed === "number" && isFinite(merged.defaultSpeed)
            ? merged.defaultSpeed
            : defaults.defaultSpeed!,
        ),
      );
      merged.countInBeats = clampNum(
        merged.countInBeats,
        0,
        8,
        defaults.countInBeats!,
      );
      merged.latencyCompensation = clampNum(
        merged.latencyCompensation,
        0,
        200,
        defaults.latencyCompensation!,
      );
      merged.noteReleaseMs = clampNum(
        merged.noteReleaseMs,
        50,
        300,
        defaults.noteReleaseMs!,
      );
      return merged;
    }
  } catch {
    // localStorage might not be available
  }
  return { ...defaults };
}

/** In-memory cache of persisted settings to avoid stale-read race when
 *  multiple settings are written synchronously in the same microtask. */
let _persistedCache: PersistedSettings | null = null;

function persist(patch: Partial<PersistedSettings>): void {
  try {
    if (!_persistedCache) {
      const raw = localStorage.getItem(STORAGE_KEY);
      _persistedCache = raw ? (JSON.parse(raw) as PersistedSettings) : {};
    }
    _persistedCache = { ..._persistedCache, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_persistedCache));
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
    lastNonZeroVolume:
      saved.lastNonZeroVolume ?? saved.volume ?? defaults.lastNonZeroVolume!,
    defaultSpeed: saved.defaultSpeed ?? defaults.defaultSpeed!,
    defaultMode: VALID_PRACTICE_MODES.includes(
      saved.defaultMode as PracticeMode,
    )
      ? (saved.defaultMode as PracticeMode)
      : "watch",
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
    kidMode: saved.kidMode ?? defaults.kidMode!,

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
      if (clamped > 0) {
        persist({ volume: clamped, lastNonZeroVolume: clamped });
        set({ volume: clamped, lastNonZeroVolume: clamped });
      } else {
        persist({ volume: clamped });
        set({ volume: clamped });
      }
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
      if (!VALID_PRACTICE_MODES.includes(m)) return;
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
    setKidMode: (v) => {
      persist({ kidMode: v });
      set({ kidMode: v });
    },
  };
});
