import { describe, expect, test } from "vitest";
import { shouldExposeE2eFixtures } from "@renderer/e2eFixtureAccess";

describe("shouldExposeE2eFixtures", () => {
  test("allows exposure when isE2eTestMode is true", () => {
    expect(shouldExposeE2eFixtures({ isE2eTestMode: true })).toBe(true);
  });

  test("disallows exposure when isE2eTestMode is falsy", () => {
    expect(shouldExposeE2eFixtures({ isE2eTestMode: false })).toBe(false);
  });
});
