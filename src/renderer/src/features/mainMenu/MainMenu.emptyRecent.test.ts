import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { en } from "@renderer/locales/en";
import { zhTW } from "@renderer/locales/zh-TW";

describe("main menu empty recent-play copy", () => {
  test("points first-run users at the library instead of MIDI import", () => {
    const source = readFileSync(resolve(__dirname, "MainMenu.tsx"), "utf8");
    expect(source).toContain("library.emptyRecentHint");
    expect(source).not.toContain('t("library.noSongsHint")');

    const enHint = en["library.emptyRecentHint"];
    const zhHint = zhTW["library.emptyRecentHint"];
    expect(enHint.toLowerCase()).not.toMatch(/import a midi/);
    expect(zhHint).not.toMatch(/匯入 MIDI/);
    expect(enHint.toLowerCase()).toMatch(/library|start playing/);
  });
});
