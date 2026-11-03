import { describe, expect, test } from "vitest";
import { shouldExposeE2eFixtures } from "./e2eFixtureAccess";

describe("shouldExposeE2eFixtures", () => {
  test("requires preload-provided E2E test mode", () => {
    expect(shouldExposeE2eFixtures({ isE2eTestMode: false })).toBe(false);
    expect(shouldExposeE2eFixtures({ isE2eTestMode: true })).toBe(true);
  });
});
