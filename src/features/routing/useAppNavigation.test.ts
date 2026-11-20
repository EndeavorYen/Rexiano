import { describe, expect, test } from "vitest";
import { playbackExitRoute, shouldSyncRouteHash } from "./useAppNavigation";

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

describe("playbackExitRoute (#325)", () => {
  test("returns to the map when the song was started from the map", () => {
    expect(playbackExitRoute("menu")).toBe("menu");
  });

  test("returns to the library when the song was started from the shelf", () => {
    expect(playbackExitRoute("library")).toBe("library");
  });

  test("falls back to the library when the origin is unknown", () => {
    expect(playbackExitRoute("playback")).toBe("library");
  });
});
