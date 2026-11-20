import { describe, expect, test } from "vitest";
import { getModeSelectionOptions } from "./modeSelectionOptions";

describe("getModeSelectionOptions", () => {
  test("presents Watch and Wait in the player-facing order", () => {
    expect(getModeSelectionOptions().map((option) => option.mode)).toEqual([
      "watch",
      "wait",
    ]);
  });

  test("exactly one card is primary, and it is Wait (play along)", () => {
    const primary = getModeSelectionOptions().filter(
      (option) => option.isPrimary,
    );
    expect(primary).toHaveLength(1);
    expect(primary[0].mode).toBe("wait");
  });
});
