import { describe, expect, test } from "vitest";
import { formatSongTag, previewTags } from "./songTagLabel";
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

describe("song tag coverage", () => {
  test("every built-in tag has a zh-TW label, not an English fallback", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const raw = JSON.parse(
      readFileSync(resolve(process.cwd(), "resources/midi/songs.json"), "utf8"),
    ) as { tags?: string[] }[] | { songs: { tags?: string[] }[] };
    const songs = Array.isArray(raw) ? raw : raw.songs;
    const tags = new Set(songs.flatMap((song) => song.tags ?? []));
    const zh = translator(zhTW);
    for (const tag of tags) {
      expect(formatSongTag(tag, zh), tag).not.toMatch(/[a-z]{3,}/);
    }
  });

  test("translates genre tags", () => {
    expect(formatSongTag("baroque", translator(zhTW))).toBe("巴洛克");
    expect(formatSongTag("alberti-bass", translator(en))).toBe("Alberti bass");
  });
});

describe("previewTags", () => {
  test("drops the tag that repeats the category", () => {
    expect(previewTags(["classical", "baroque", "3-4"], "classical")).toEqual([
      "baroque",
      "3-4",
    ]);
    expect(previewTags(["folk"], null)).toEqual(["folk"]);
  });
});
