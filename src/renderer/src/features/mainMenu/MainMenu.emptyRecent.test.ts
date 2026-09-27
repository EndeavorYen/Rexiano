import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

describe("main menu first run", () => {
  test("points first-run users at the library instead of MIDI import", () => {
    const source = readFileSync(resolve(__dirname, "MainMenu.tsx"), "utf8");
    expect(source).not.toContain('t("library.noSongsHint")');

    // With no recents the empty card is hidden (#292); the primary action,
    // listed before import, is the way into the library.
    expect(source).not.toContain("main-menu-empty-recent");
    const start = source.indexOf('t("app.startPractice")');
    const importMidi = source.indexOf('t("library.importMidi")');
    expect(start).toBeGreaterThan(-1);
    expect(importMidi).toBeGreaterThan(start);
    expect(source).toContain("btn-primary-themed");
  });
});
