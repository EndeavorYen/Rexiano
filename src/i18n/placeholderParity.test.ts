import { describe, expect, test } from "vitest";
import { en } from "@renderer/locales/en";
import { zhTW } from "@renderer/locales/zh-TW";
import type { TranslationMap } from "./types";
import {
  extractInterpolationPlaceholders,
  findPlaceholderParityIssues,
} from "./placeholderParity";

describe("placeholderParity", () => {
  test("extracts unique interpolation placeholders", () => {
    expect(
      extractInterpolationPlaceholders(
        "Practiced {count} times in {count} sessions for {name}",
      ),
    ).toEqual(["count", "name"]);
  });

  test("reports mismatched placeholders between locales", () => {
    const base = {
      "practice.trackN": "Track {n}",
      "settings.backupExportSuccess": "Exported {count}",
    } as TranslationMap;
    const target = {
      "practice.trackN": "軌道 {track}",
      "settings.backupExportSuccess": "已匯出 {count}",
    } as TranslationMap;

    expect(findPlaceholderParityIssues(base, target)).toEqual([
      {
        key: "practice.trackN",
        basePlaceholders: ["n"],
        targetPlaceholders: ["track"],
      },
    ]);
  });

  test("English and Traditional Chinese placeholders stay in sync", () => {
    expect(findPlaceholderParityIssues(en, zhTW)).toEqual([]);
  });
});
