import { describe, expect, test } from "vitest";
import { openKeepingDisplayMode } from "./keepDisplayMode";
import type { DisplayMode } from "../sheetMusic/types";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fakeStore(initial: DisplayMode) {
  const state = { mode: initial };
  return {
    state,
    access: {
      get: () => state.mode,
      set: (mode: DisplayMode) => {
        state.mode = mode;
      },
    },
  };
}

describe("openKeepingDisplayMode", () => {
  test("puts the child's choice back after the song's own default is applied", async () => {
    const { state, access } = fakeStore("falling");
    const result = await openKeepingDisplayMode(async () => {
      state.mode = "split"; // what opening a song does
      return "title";
    }, access);
    expect(result).toBe("title");
    expect(state.mode).toBe("falling");
  });

  test("leaves a mode that did not change alone", async () => {
    const { state, access } = fakeStore("split");
    await openKeepingDisplayMode(async () => null, access);
    expect(state.mode).toBe("split");
  });
});
