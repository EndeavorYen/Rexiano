/**
 * Phase 6.5: Global keyboard shortcuts for playback and practice controls.
 *
 * Binds to window keydown events. Skips shortcuts when focus is inside
 * an input or textarea to avoid interfering with text entry.
 */
import { useEffect, useRef } from "react";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { getPracticeEngines } from "@renderer/engines/practice/practiceManager";
import type { PracticeMode } from "@shared/types";

/** Seek offset in seconds for arrow-key shortcuts */
const SEEK_STEP = 5;
/** Seek offset for Shift+Arrow shortcuts */
const SEEK_STEP_LARGE = 15;
/** Speed change per arrow key press */
const SPEED_STEP = 0.25;
const SHORTCUT_BLOCKING_OVERLAY_SELECTOR = [
  "[data-testid='mode-selection-modal']",
  "[data-testid='settings-panel']",
  "[data-testid='insights-modal']",
  "[data-testid='statistics-page']",
  "[data-testid='celebration-overlay']",
  "[data-testid='count-in-overlay']",
].join(", ");

/** Whether the shortcut help overlay is currently shown (toggled by ?) */
let _showHelp = false;
const _helpListeners = new Set<(show: boolean) => void>();

export function onHelpChange(cb: (show: boolean) => void): () => void {
  _helpListeners.add(cb);
  return () => {
    _helpListeners.delete(cb);
  };
}

function setShowHelp(show: boolean): void {
  _showHelp = show;
  for (const cb of _helpListeners) cb(_showHelp);
}

export function getShowHelp(): boolean {
  return _showHelp;
}

/** Mode map: number key → PracticeMode */
const MODE_MAP: Record<string, PracticeMode> = {
  "1": "watch",
  "2": "wait",
  "3": "free",
};

/**
 * Returns true if the event target is an element that accepts text input,
 * in which case we should not intercept the keystroke.
 */
function isTextInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function hasShortcutBlockingOverlay(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(SHORTCUT_BLOCKING_OVERLAY_SELECTOR) !== null;
}

export interface KeyboardShortcutDeps {
  /** Called to open a MIDI file dialog. If omitted, Ctrl/Cmd+O is a no-op. */
  onOpenFile?: () => void;
  /** Called to toggle mute. If omitted, M key is a no-op. */
  onToggleMute?: () => void;
}

/**
 * Hook that registers global keyboard shortcuts.
 * Call once in the top-level App component.
 */
/**
 * Create the keydown handler used by the hook.
 * Extracted as a factory so it can be tested without React rendering.
 */
export function createKeyboardHandler(
  getDeps: () => KeyboardShortcutDeps,
): (e: KeyboardEvent) => void {
  return function handler(e: KeyboardEvent): void {
    if (e.defaultPrevented) return;
    if (isTextInput(e.target)) return;
    if (hasShortcutBlockingOverlay()) return;

    const hasSong = useSongStore.getState().song !== null;

    switch (e.code) {
      // ── Playback ────────────────────────────────────
      case "Space": {
        e.preventDefault();
        if (!hasSong) return;
        const pb = usePlaybackStore.getState();
        pb.setPlaying(!pb.isPlaying);
        break;
      }

      case "KeyR": {
        if (e.ctrlKey || e.metaKey) return; // don't intercept Ctrl+R (reload)
        if (!hasSong) return;
        usePlaybackStore.getState().setCurrentTime(0);
        break;
      }

      case "ArrowLeft": {
        e.preventDefault();
        if (!hasSong) return;
        // In step mode, ArrowLeft goes to previous note/chord
        if (usePracticeStore.getState().mode === "step") {
          const { stepMode } = getPracticeEngines();
          if (stepMode) {
            const chord = stepMode.goBack();
            if (chord) {
              usePlaybackStore.getState().setCurrentTime(chord.time);
            }
          }
          break;
        }
        if (e.shiftKey) {
          // Shift+← : large seek backward
          const ct = usePlaybackStore.getState().currentTime;
          usePlaybackStore
            .getState()
            .setCurrentTime(Math.max(0, ct - SEEK_STEP_LARGE));
        } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          // ← : seek backward
          const ct = usePlaybackStore.getState().currentTime;
          usePlaybackStore
            .getState()
            .setCurrentTime(Math.max(0, ct - SEEK_STEP));
        }
        break;
      }

      case "ArrowRight": {
        e.preventDefault();
        if (!hasSong) return;
        // In step mode, ArrowRight advances to next note/chord
        if (usePracticeStore.getState().mode === "step") {
          const { stepMode } = getPracticeEngines();
          if (stepMode) {
            const chord = stepMode.advance();
            if (chord) {
              usePlaybackStore.getState().setCurrentTime(chord.time);
            }
          }
          break;
        }
        const duration = useSongStore.getState().song?.duration ?? 0;
        if (e.shiftKey) {
          const ct = usePlaybackStore.getState().currentTime;
          usePlaybackStore
            .getState()
            .setCurrentTime(Math.min(duration, ct + SEEK_STEP_LARGE));
        } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const ct = usePlaybackStore.getState().currentTime;
          usePlaybackStore
            .getState()
            .setCurrentTime(Math.min(duration, ct + SEEK_STEP));
        }
        break;
      }

      // ── Speed ───────────────────────────────────────
      case "ArrowUp":
      case "BracketRight": {
        e.preventDefault();
        if (!hasSong) return;
        const curSpeed = usePracticeStore.getState().speed;
        usePracticeStore.getState().setSpeed(curSpeed + SPEED_STEP);
        break;
      }

      case "ArrowDown":
      case "BracketLeft": {
        e.preventDefault();
        if (!hasSong) return;
        const curSpeedDown = usePracticeStore.getState().speed;
        usePracticeStore.getState().setSpeed(curSpeedDown - SPEED_STEP);
        break;
      }

      // ── Loop A/B point setting ───────────────────────
      case "KeyA": {
        if (!hasSong) return;
        const songA = useSongStore.getState().song;
        const timeA = usePlaybackStore.getState().currentTime;
        const loopA = usePracticeStore.getState().loopRange;
        usePracticeStore
          .getState()
          .setLoopRange([timeA, loopA?.[1] ?? songA?.duration ?? timeA + 1]);
        break;
      }

      case "KeyB": {
        if (!hasSong) return;
        const timeB = usePlaybackStore.getState().currentTime;
        const loopB = usePracticeStore.getState().loopRange;
        usePracticeStore.getState().setLoopRange([loopB?.[0] ?? 0, timeB]);
        break;
      }

      // ── Stop / close ─────────────────────────────────
      case "Escape": {
        if (!hasSong) return;
        const pb = usePlaybackStore.getState();
        if (pb.isPlaying) {
          pb.setPlaying(false);
        }
        break;
      }

      // ── Loop toggle ─────────────────────────────────
      case "KeyL": {
        if (!hasSong) return;
        const ps = usePracticeStore.getState();
        if (ps.loopRange) {
          ps.setLoopRange(null);
        }
        // When no loop is active, L is a no-op (loop points must be set via A/B keys or UI)
        break;
      }

      // ── Mode switching ──────────────────────────────
      case "Digit1":
      case "Digit2":
      case "Digit3": {
        if (!hasSong) return;
        const mode = MODE_MAP[e.code.replace("Digit", "")];
        if (mode) usePracticeStore.getState().setMode(mode);
        break;
      }

      // ── Mute toggle ─────────────────────────────────
      case "KeyM": {
        if (!hasSong) return;
        getDeps().onToggleMute?.();
        break;
      }

      // ── Open file ───────────────────────────────────
      case "KeyO": {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          getDeps().onOpenFile?.();
        }
        break;
      }

      // ── Help overlay ────────────────────────────────
      default: {
        if (e.key === "?") {
          setShowHelp(!_showHelp);
        }
        break;
      }
    }
  };
}

/**
 * Hook that registers global keyboard shortcuts.
 * Call once in the top-level App component.
 */
export function useKeyboardShortcuts(deps: KeyboardShortcutDeps = {}): void {
  // Store deps in a ref so the effect can always read the latest callbacks
  // without re-attaching the listener on every render.
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  useEffect(() => {
    const handler = createKeyboardHandler(() => depsRef.current);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // stable — deps accessed via ref
}

// Exported for testing and KeyboardShortcutsHelp component
export {
  isTextInput,
  hasShortcutBlockingOverlay,
  setShowHelp,
  SEEK_STEP,
  SEEK_STEP_LARGE,
  SPEED_STEP,
  MODE_MAP,
};
