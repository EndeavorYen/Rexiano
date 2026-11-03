import { describe, expect, test } from "vitest";
import { PLAYBACK_EXIT_ROUTE, shouldSyncRouteHash } from "./useAppNavigation";

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

describe("PLAYBACK_EXIT_ROUTE (#325)", () => {
  test("the playback header's 曲庫 button returns to the library", () => {
    expect(PLAYBACK_EXIT_ROUTE).toBe("library");
  });
});
