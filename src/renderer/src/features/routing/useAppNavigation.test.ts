import { describe, expect, test } from "vitest";
import { shouldSyncRouteHash } from "./useAppNavigation";

describe("shouldSyncRouteHash", () => {
  test("returns true when current hash differs from target hash", () => {
    expect(shouldSyncRouteHash("#/menu", "#/library")).toBe(true);
    expect(shouldSyncRouteHash("", "#/menu")).toBe(true);
  });

  test("returns false when current hash matches target hash", () => {
    expect(shouldSyncRouteHash("#/menu", "#/menu")).toBe(false);
    expect(shouldSyncRouteHash("#/library", "#/library")).toBe(false);
  });
});
