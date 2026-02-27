/**
 * Tests for the useRecentFiles hook.
 *
 * Since @testing-library/react is not available, we test by importing
 * the hook and validating that it correctly calls window.api methods.
 * We use a minimal React-like environment via vi.mock for React hooks.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import type { RecentFile } from "@shared/types";

// ─── Mock window.api ─────────────────────────────────
const mockRecentFiles: RecentFile[] = [
  {
    path: "/songs/song1.mid",
    name: "song1.mid",
    timestamp: 1_700_000_000_000,
  },
  {
    path: "builtin:twinkle",
    name: "Twinkle Twinkle",
    timestamp: 1_699_999_000_000,
  },
  {
    path: "/songs/song2.mid",
    name: "song2.mid",
    timestamp: 1_699_998_000_000,
  },
];

vi.stubGlobal("window", {
  api: {
    loadRecentFiles: vi.fn(async () => [...mockRecentFiles]),
    saveRecentFile: vi.fn(async () => {}),
    loadMidiPath: vi.fn(async () => null),
    loadBuiltinSong: vi.fn(async () => null),
  },
});

// ─── Capture React hook calls ─────────────────────────
// We intercept useState and useEffect to run the hook logic
// without a React render tree.
let capturedStates: Map<number, [unknown, (v: unknown) => void]>;
let capturedEffects: Array<() => void>;
let stateCounter: number;

vi.mock("react", () => {
  return {
    useState: (initial: unknown) => {
      const idx = stateCounter++;
      if (!capturedStates.has(idx)) {
        const setter = (val: unknown): void => {
          capturedStates.set(idx, [val, setter]);
        };
        capturedStates.set(idx, [initial, setter]);
      }
      const entry = capturedStates.get(idx)!;
      return [entry[0], entry[1]];
    },
    useEffect: (fn: () => void) => {
      capturedEffects.push(fn);
    },
    useCallback: (fn: unknown) => fn,
    useRef: (initial: unknown) => ({ current: initial }),
  };
});

import { useRecentFiles } from "./useRecentFiles";

function resetHookState(): void {
  capturedStates = new Map();
  capturedEffects = [];
  stateCounter = 0;
}

describe("useRecentFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetHookState();
    vi.mocked(window.api.loadRecentFiles).mockResolvedValue([
      ...mockRecentFiles,
    ]);
  });

  test("returns initial state with loading=true and empty recentFiles", () => {
    const result = useRecentFiles();

    expect(result.loading).toBe(true);
    expect(result.recentFiles).toEqual([]);
    expect(typeof result.refresh).toBe("function");
  });

  test("registers an effect that calls loadRecentFiles", () => {
    useRecentFiles();

    // The hook should have registered one useEffect
    expect(capturedEffects.length).toBeGreaterThanOrEqual(1);
  });

  test("effect calls window.api.loadRecentFiles", async () => {
    useRecentFiles();

    // Execute the effect
    capturedEffects[0]();

    expect(window.api.loadRecentFiles).toHaveBeenCalledTimes(1);
  });

  test("refresh function calls window.api.loadRecentFiles", async () => {
    const result = useRecentFiles();

    result.refresh();

    expect(window.api.loadRecentFiles).toHaveBeenCalledTimes(1);
  });

  test("refresh sets loading to true before the API call", () => {
    // Initial call to set up hook state
    useRecentFiles();

    // Track state changes
    const setterCalls: unknown[] = [];
    const originalSet = capturedStates.get(1)![1]; // loading setter (index 1)
    capturedStates.get(1)![1] = (val: unknown) => {
      setterCalls.push(val);
      originalSet(val);
    };

    // Reset state counter so the hook re-reads from existing state
    stateCounter = 0;
    const result = useRecentFiles();
    result.refresh();

    // The first setter call should set loading to true
    expect(setterCalls[0]).toBe(true);
  });

  test("handles API error gracefully without throwing", async () => {
    vi.mocked(window.api.loadRecentFiles).mockRejectedValueOnce(
      new Error("disk error"),
    );

    const result = useRecentFiles();

    // Execute refresh — should not throw
    await expect(
      (async () => {
        result.refresh();
        // Wait for the promise chain to settle
        await vi.mocked(window.api.loadRecentFiles).mock.results[0]?.value?.catch?.(() => {});
      })(),
    ).resolves.toBeUndefined();
  });
});
