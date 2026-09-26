import { describe, expect, test } from "vitest";
import type { PracticeMode } from "@shared/types";
import { getModeSelectionOptions } from "./modeSelectionOptions";

describe("getModeSelectionOptions", () => {
  test("presents Watch and Wait in the player-facing order", () => {
    expect(
      getModeSelectionOptions("watch").map((option) => option.mode),
    ).toEqual(["watch", "wait"]);
  });

  test("maps a saved Free default onto Wait", () => {
    expect(
      getModeSelectionOptions("free").find((option) => option.isDefault)?.mode,
    ).toBe("wait");
  });

  test.each<PracticeMode>(["watch", "wait"])(
    "marks exactly the passed %s mode as the current per-song default",
    (defaultMode) => {
      const options = getModeSelectionOptions(defaultMode);

      expect(options.filter((option) => option.isDefault)).toHaveLength(1);
      expect(options.find((option) => option.isDefault)?.mode).toBe(
        defaultMode,
      );
    },
  );
});
