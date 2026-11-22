import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("main menu first run", () => {
  test("opens with the map, not a list of recents or a second yellow button", () => {
    const source = readFileSync(resolve(__dirname, "MainMenu.tsx"), "utf8");
    expect(source).not.toContain('t("library.noSongsHint")');
    // With no imported recents the strip is hidden (#292).
    expect(source).toContain("showRecents");
    expect(source).not.toContain("main-menu-empty-recent");
    // The only sun-yellow button lives on the station card.
    expect(source).not.toContain("btn-primary-themed");
    // First-run users get an invitation, not blank numbers.
    expect(source).toContain("map.firstInvite");
  });
});
