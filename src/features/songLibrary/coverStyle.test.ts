import { describe, expect, test } from "vitest";
import {
  COVER_SHAPES,
  COVER_TONES,
  coverStyle,
  coverVariantsByUnit,
} from "./coverStyle";
import type { BuiltinSongMeta } from "@shared/types";

describe("coverStyle", () => {
  test("is stable for the same seed", () => {
    expect(coverStyle("hot-cross-buns")).toEqual(coverStyle("hot-cross-buns"));
    expect(coverStyle("x", 7)).toEqual(coverStyle("x", 7));
  });

  test("stays inside the tone and shape ranges", () => {
    for (let i = 0; i < 200; i += 1) {
      for (const style of [coverStyle(`song-${i}`), coverStyle("s", i)]) {
        expect(style.tone).toBeGreaterThanOrEqual(0);
        expect(style.tone).toBeLessThan(COVER_TONES);
        expect(style.shape).toBeGreaterThanOrEqual(0);
        expect(style.shape).toBeLessThan(COVER_SHAPES);
      }
    }
  });

  test("hashed styles spread roughly evenly over all 12 looks", () => {
    const counts = new Map<string, number>();
    const total = 1200;
    for (let i = 0; i < total; i += 1) {
      const { tone, shape } = coverStyle(`song-${i}`);
      const key = `${tone}-${shape}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(COVER_TONES * COVER_SHAPES);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(total / 12 / 2);
      expect(count).toBeLessThan((total / 12) * 2);
    }
  });

  test("with a shelf position, neighbours never share a tone or the whole look", () => {
    for (let i = 0; i < 60; i += 1) {
      const a = coverStyle("a", i);
      const b = coverStyle("b", i + 1);
      expect(a.tone).not.toBe(b.tone);
      expect(`${a.tone}-${a.shape}`).not.toBe(`${b.tone}-${b.shape}`);
    }
  });

  test("a shelf position walks through every look before repeating", () => {
    const looks = new Set<string>();
    for (let i = 0; i < 12; i += 1) {
      const { tone, shape } = coverStyle("s", i);
      looks.add(`${tone}-${shape}`);
    }
    expect(looks.size).toBe(12);
  });
});

describe("coverVariantsByUnit", () => {
  const song = (id: string, grade: number): BuiltinSongMeta => ({
    id,
    file: `${id}.mid`,
    title: id,
    composer: "x",
    difficulty: "beginner",
    category: "popular",
    durationSeconds: 10,
    tags: [],
    grade: grade as BuiltinSongMeta["grade"],
  });

  test("numbers songs from 0 inside each unit, in shelf order", () => {
    const map = coverVariantsByUnit([song("b", 1), song("a", 1), song("z", 0)]);
    expect(map.get("z")).toBe(0);
    expect(map.get("a")).toBe(0);
    expect(map.get("b")).toBe(1);
  });
});
