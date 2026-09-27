import { describe, expect, test } from "vitest";
import { formatSongTag } from "./songTagLabel";
import { en } from "@renderer/locales/en";
import { zhTW } from "@renderer/locales/zh-TW";
import type {
  InterpolationParams,
  TranslationKey,
  TranslationMap,
} from "@renderer/i18n/types";

function translator(map: TranslationMap) {
  return (key: TranslationKey, params?: InterpolationParams): string =>
    map[key].replace(/\{(\w+)\}/g, (_, name: string) =>
      String(params?.[name] ?? ""),
    );
}

describe("formatSongTag", () => {
  const t = translator(en);

  test("formats meters, levels and keys", () => {
    expect(formatSongTag("3-4", t)).toBe("3/4");
    expect(formatSongTag("level-5", t)).toBe("Level 5");
    expect(formatSongTag("g-major", t)).toBe("G major");
    expect(formatSongTag("c#-minor", t)).toBe("C# minor");
  });

  test("translates common tags and prettifies the rest", () => {
    expect(formatSongTag("two-hands", t)).toBe("Two hands");
    expect(formatSongTag("alberti-bass", t)).toBe("Alberti bass");
    expect(formatSongTag("baroque", t)).toBe("Baroque");
  });

  test("uses zh-TW strings", () => {
    const zh = translator(zhTW);
    expect(formatSongTag("level-5", zh)).toBe("第 5 級");
    expect(formatSongTag("g-major", zh)).toBe("G 大調");
    expect(formatSongTag("two-hands", zh)).toBe("雙手");
  });
});
