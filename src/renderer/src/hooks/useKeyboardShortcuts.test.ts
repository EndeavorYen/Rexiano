/**
 * Tests for createKeyboardHandler — the actual handler logic
 * extracted from the useKeyboardShortcuts hook.
 *
 * No DOM environment needed: we call the handler directly with
 * minimal KeyboardEvent-like objects.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock Zustand stores before importing
vi.mock("@renderer/stores/usePlaybackStore", () => {
  const state = {
    currentTime: 10,
    isPlaying: false,
    setCurrentTime: vi.fn(),
    setPlaying: vi.fn(),
  };
  const store = Object.assign(() => state, {
    getState: () => state,
    subscribe: vi.fn(),
    setState: vi.fn(),
  });
  return { usePlaybackStore: store };
});

vi.mock("@renderer/stores/usePracticeStore", () => {
  const state = {
    speed: 1.0,
    loopRange: null as [number, number] | null,
    setSpeed: vi.fn(),
    setLoopRange: vi.fn(),
    setMode: vi.fn(),
  };
  const store = Object.assign(() => state, {
    getState: () => state,
    subscribe: vi.fn(),
    setState: vi.fn(),
  });
  return { usePracticeStore: store };
});

vi.mock("@renderer/stores/useSongStore", () => {
  const state = {
    song: {
      duration: 120,
      tracks: [],
      noteCount: 0,
      tempos: [],
      timeSignatures: [],
      fileName: "test.mid",
    },
  };
  const store = Object.assign(() => state, {
    getState: () => state,
    subscribe: vi.fn(),
    setState: vi.fn(),
  });
  return { useSongStore: store };
});

import {
  createKeyboardHandler,
  isTextInput,
  SEEK_STEP,
  SEEK_STEP_LARGE,
  SPEED_STEP,
} from "./useKeyboardShortcuts";
import type { KeyboardShortcutDeps } from "./useKeyboardShortcuts";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSongStore } from "@renderer/stores/useSongStore";

/** Minimal KeyboardEvent-like object for direct handler invocation. */
function makeKeyEvent(
  code: string,
  opts: {
    key?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    target?: unknown;
  } = {},
): KeyboardEvent {
  return {
    code,
    key: opts.key ?? code,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    target: opts.target ?? null,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

let handler: (e: KeyboardEvent) => void;
let currentDeps: KeyboardShortcutDeps = {};

function setupHandler(deps: KeyboardShortcutDeps = {}): void {
  currentDeps = deps;
  handler = createKeyboardHandler(() => currentDeps);
}

function fireKey(
  code: string,
  opts: Parameters<typeof makeKeyEvent>[1] = {},
): void {
  handler(makeKeyEvent(code, opts));
}

describe("useKeyboardShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (usePlaybackStore.getState() as { currentTime: number }).currentTime = 10;
    (usePlaybackStore.getState() as { isPlaying: boolean }).isPlaying = false;
    (usePracticeStore.getState() as { speed: number }).speed = 1.0;
    (
      usePracticeStore.getState() as { loopRange: [number, number] | null }
    ).loopRange = null;
    setupHandler();
  });

  // ─── isTextInput ────────────────────────────────────────
  // Note: isTextInput relies on `instanceof HTMLElement` which requires a DOM env.
  // We test the null/non-Element paths here; full DOM tests need jsdom.
  describe("isTextInput", () => {
    test("returns false for null target", () => {
      expect(isTextInput(null)).toBe(false);
    });

    // Note: testing with non-null, non-HTMLElement targets requires a DOM
    // environment where HTMLElement is defined. In Node-only, the instanceof
    // check throws ReferenceError. This is fine for production (always in browser).
  });

  // ─── Space — Play/Pause ─────────────────────────────────
  describe("Space — Play/Pause", () => {
    test("toggles play state", () => {
      fireKey("Space");
      expect(usePlaybackStore.getState().setPlaying).toHaveBeenCalledWith(true);
    });

    test("toggles pause when already playing", () => {
      (usePlaybackStore.getState() as { isPlaying: boolean }).isPlaying = true;
      fireKey("Space");
      expect(usePlaybackStore.getState().setPlaying).toHaveBeenCalledWith(
        false,
      );
    });
  });

  // ─── R — Reset ──────────────────────────────────────────
  describe("R — Reset", () => {
    test("resets time to 0", () => {
      fireKey("KeyR");
      expect(usePlaybackStore.getState().setCurrentTime).toHaveBeenCalledWith(
        0,
      );
    });

    test("does not reset on Ctrl+R", () => {
      fireKey("KeyR", { ctrlKey: true });
      expect(usePlaybackStore.getState().setCurrentTime).not.toHaveBeenCalled();
    });
  });

  // ─── Arrow Left/Right — Seek ────────────────────────────
  describe("Arrow Left/Right — Seek", () => {
    test("ArrowLeft seeks backward by SEEK_STEP", () => {
      fireKey("ArrowLeft");
      expect(usePlaybackStore.getState().setCurrentTime).toHaveBeenCalledWith(
        10 - SEEK_STEP,
      );
    });

    test("ArrowRight seeks forward by SEEK_STEP", () => {
      fireKey("ArrowRight");
      expect(usePlaybackStore.getState().setCurrentTime).toHaveBeenCalledWith(
        10 + SEEK_STEP,
      );
    });

    test("Shift+ArrowLeft seeks backward by SEEK_STEP_LARGE (clamped to 0)", () => {
      // currentTime=10, SEEK_STEP_LARGE=15, Math.max(0, 10-15) = 0
      fireKey("ArrowLeft", { shiftKey: true });
      expect(usePlaybackStore.getState().setCurrentTime).toHaveBeenCalledWith(
        0,
      );
    });

    test("Shift+ArrowRight seeks forward by SEEK_STEP_LARGE", () => {
      fireKey("ArrowRight", { shiftKey: true });
      expect(usePlaybackStore.getState().setCurrentTime).toHaveBeenCalledWith(
        10 + SEEK_STEP_LARGE,
      );
    });

    test("ArrowLeft clamps to 0", () => {
      (usePlaybackStore.getState() as { currentTime: number }).currentTime = 2;
      fireKey("ArrowLeft");
      expect(usePlaybackStore.getState().setCurrentTime).toHaveBeenCalledWith(
        0,
      );
    });

    test("ArrowRight clamps to song duration", () => {
      (usePlaybackStore.getState() as { currentTime: number }).currentTime =
        118;
      fireKey("ArrowRight");
      expect(usePlaybackStore.getState().setCurrentTime).toHaveBeenCalledWith(
        120,
      );
    });
  });

  // ─── Arrow Up/Down — Speed ──────────────────────────────
  describe("Arrow Up/Down — Speed", () => {
    test("ArrowUp increases speed by SPEED_STEP", () => {
      fireKey("ArrowUp");
      expect(usePracticeStore.getState().setSpeed).toHaveBeenCalledWith(
        1.0 + SPEED_STEP,
      );
    });

    test("ArrowDown decreases speed by SPEED_STEP", () => {
      fireKey("ArrowDown");
      expect(usePracticeStore.getState().setSpeed).toHaveBeenCalledWith(
        1.0 - SPEED_STEP,
      );
    });
  });

  // ─── L — Loop toggle ───────────────────────────────────
  describe("L — Loop toggle", () => {
    test("clears loop when loop is active", () => {
      (
        usePracticeStore.getState() as { loopRange: [number, number] | null }
      ).loopRange = [10, 20];
      fireKey("KeyL");
      expect(usePracticeStore.getState().setLoopRange).toHaveBeenCalledWith(
        null,
      );
    });

    test("does nothing when no loop is active", () => {
      fireKey("KeyL");
      expect(usePracticeStore.getState().setLoopRange).not.toHaveBeenCalled();
    });
  });

  // ─── 1/2/3 — Mode switching ────────────────────────────
  describe("1/2/3 — Mode switching", () => {
    test("1 switches to watch mode", () => {
      fireKey("Digit1");
      expect(usePracticeStore.getState().setMode).toHaveBeenCalledWith("watch");
    });

    test("2 switches to wait mode", () => {
      fireKey("Digit2");
      expect(usePracticeStore.getState().setMode).toHaveBeenCalledWith("wait");
    });

    test("3 switches to free mode", () => {
      fireKey("Digit3");
      expect(usePracticeStore.getState().setMode).toHaveBeenCalledWith("free");
    });
  });

  // ─── M — Mute toggle ───────────────────────────────────
  describe("M — Mute toggle", () => {
    test("calls onToggleMute when provided", () => {
      const onToggleMute = vi.fn();
      setupHandler({ onToggleMute });
      fireKey("KeyM");
      expect(onToggleMute).toHaveBeenCalled();
    });

    test("does nothing when onToggleMute is not provided", () => {
      // No error thrown
      fireKey("KeyM");
    });
  });

  // ─── Ctrl+O — Open file ────────────────────────────────
  describe("Ctrl+O — Open file", () => {
    test("calls onOpenFile with Ctrl key", () => {
      const onOpenFile = vi.fn();
      setupHandler({ onOpenFile });
      fireKey("KeyO", { ctrlKey: true });
      expect(onOpenFile).toHaveBeenCalled();
    });

    test("calls onOpenFile with Meta key", () => {
      const onOpenFile = vi.fn();
      setupHandler({ onOpenFile });
      fireKey("KeyO", { metaKey: true });
      expect(onOpenFile).toHaveBeenCalled();
    });

    test("does not call onOpenFile without modifier", () => {
      const onOpenFile = vi.fn();
      setupHandler({ onOpenFile });
      fireKey("KeyO");
      expect(onOpenFile).not.toHaveBeenCalled();
    });
  });

  // Input element skipping tests require a DOM environment (jsdom).
  // The isTextInput function uses `instanceof HTMLElement` which
  // needs real DOM globals. Skipped in this Node-only test suite.

  // ─── No song loaded ─────────────────────────────────────
  describe("no song loaded", () => {
    test("Space does nothing when no song", () => {
      (useSongStore.getState() as { song: null }).song = null;
      fireKey("Space");
      expect(usePlaybackStore.getState().setPlaying).not.toHaveBeenCalled();
    });

    test("ArrowLeft does nothing when no song", () => {
      (useSongStore.getState() as { song: null }).song = null;
      fireKey("ArrowLeft");
      expect(usePlaybackStore.getState().setCurrentTime).not.toHaveBeenCalled();
    });
  });
});
