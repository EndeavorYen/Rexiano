import { describe, expect, test } from "vitest";
import {
  decideHashChange,
  playbackExitRoute,
  shouldSyncRouteHash,
} from "./useAppNavigation";

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

describe("decideHashChange (browser Back during playback)", () => {
  test("Back to a browse hash while a song is open leaves playback", () => {
    expect(decideHashChange("library", true, false)).toBe("exit-playback");
    expect(decideHashChange("menu", true, false)).toBe("exit-playback");
  });

  test("the playback hash with a song open is not an exit", () => {
    expect(decideHashChange("playback", true, false)).toBe("apply");
  });

  test("hash changes we made ourselves are applied, never treated as Back", () => {
    expect(decideHashChange("library", true, true)).toBe("apply");
  });

  test("without a song every hash change just sets the route", () => {
    expect(decideHashChange("library", false, false)).toBe("apply");
    expect(decideHashChange("menu", false, false)).toBe("apply");
  });
});
