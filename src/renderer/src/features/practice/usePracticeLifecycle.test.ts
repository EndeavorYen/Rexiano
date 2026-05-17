import { describe, expect, test } from "vitest";
import { resolveInitialPracticeActiveTracks } from "./usePracticeLifecycle";

describe("resolveInitialPracticeActiveTracks", () => {
  test("defaults uninitialized empty selections to every track", () => {
    expect(
      resolveInitialPracticeActiveTracks({
        trackCount: 3,
        activeTracks: new Set(),
        activeTracksInitialized: false,
      }),
    ).toEqual({
      activeTracks: new Set([0, 1, 2]),
      shouldStoreDefault: true,
    });
  });

  test("preserves an initialized empty selection from per-song setup", () => {
    expect(
      resolveInitialPracticeActiveTracks({
        trackCount: 3,
        activeTracks: new Set(),
        activeTracksInitialized: true,
      }),
    ).toEqual({
      activeTracks: new Set(),
      shouldStoreDefault: false,
    });
  });
});
