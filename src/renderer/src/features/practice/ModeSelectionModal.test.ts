import { describe, expect, test } from "vitest";
import type { PracticeMode } from "@shared/types";
import { getModeSelectionOptions } from "./modeSelectionOptions";

describe("getModeSelectionOptions", () => {
  test("presents Watch, Wait, and Free in the player-facing order", () => {
    expect(
      getModeSelectionOptions("watch").map((option) => option.mode),
    ).toEqual(["watch", "wait", "free"]);
  });

  test.each<PracticeMode>(["watch", "wait", "free"])(
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
