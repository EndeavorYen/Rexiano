import { describe, expect, test } from "vitest";
import { parseRouteHash, resolveRoute, routeToHash } from "./appRoute";

describe("appRoute", () => {
  describe("parseRouteHash", () => {
    test("parses known routes", () => {
      expect(parseRouteHash("#/menu")).toBe("menu");
      expect(parseRouteHash("#/library")).toBe("library");
      expect(parseRouteHash("#/playback")).toBe("playback");
    });

    test("accepts hashes without slash", () => {
      expect(parseRouteHash("#menu")).toBe("menu");
    });

    test("falls back to menu for invalid hashes", () => {
      expect(parseRouteHash("#/unknown")).toBe("menu");
      expect(parseRouteHash("")).toBe("menu");
    });
  });

  test("routeToHash serializes route", () => {
    expect(routeToHash("menu")).toBe("#/menu");
    expect(routeToHash("library")).toBe("#/library");
    expect(routeToHash("playback")).toBe("#/playback");
  });

  describe("resolveRoute", () => {
    test("forces playback when a song is loaded", () => {
      expect(resolveRoute("menu", true)).toBe("playback");
      expect(resolveRoute("library", true)).toBe("playback");
    });

    test("prevents playback when no song is loaded", () => {
      expect(resolveRoute("playback", false)).toBe("menu");
    });

    test("keeps non-playback routes when no song is loaded", () => {
      expect(resolveRoute("menu", false)).toBe("menu");
      expect(resolveRoute("library", false)).toBe("library");
    });
  });
});
