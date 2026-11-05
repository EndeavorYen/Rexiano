import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { irregularBars, parseBarLog } from "./import-mutopia";

const WHOLE = 1920;

describe("parseBarLog", () => {
  it("reads bar starts in ticks, including a pickup", () => {
    const log = "SCORE\n1 0 -1/8 3/4\n2 7/8 0 3/4\n3 13/8 0 3/4\n";
    expect(parseBarLog(log, 0, WHOLE)).toEqual([
      { bar: 1, start: 240, length: 1440 },
      { bar: 2, start: 1680, length: 1440 },
      { bar: 3, start: 3120, length: 1440 },
    ]);
  });

  it("picks the requested score when a file holds several", () => {
    const log = "SCORE\n1 0 0 1\nSCORE\n1 0 0 3/4\n2 3/4 0 3/4\n";
    expect(parseBarLog(log, 1, WHOLE).map((bar) => bar.length)).toEqual([
      1440, 1440,
    ]);
  });
});

describe("irregularBars", () => {
  const bar = (
    start: number,
    length = 1440,
  ): { bar: number; start: number; length: number } => ({
    bar: 0,
    start,
    length,
  });

  it("accepts a repeat end plus its pickup as one bar", () => {
    expect(
      irregularBars([bar(0), bar(1440), bar(2400), bar(2880), bar(4320)]),
    ).toEqual([]);
  });

  it("reports a bar that breaks the grid", () => {
    expect(irregularBars([bar(0), bar(1440), bar(1920), bar(3360)])).toEqual([
      { start: 1440, span: 480, next: 1920, meterLength: 1440 },
    ]);
  });
});

describe("manifest", () => {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, "manifest.json"), "utf8"),
  ) as { pieces: { id: string; grade: number; tags: string[] }[] };
  const songs = JSON.parse(
    readFileSync(join(__dirname, "../../public/midi/songs.json"), "utf8"),
  ) as { id: string; category?: string }[];

  it("lists every teaching piece in the library and nothing else", () => {
    const study = songs.filter((s) => s.category === "study").map((s) => s.id);
    expect(study.sort()).toEqual(manifest.pieces.map((p) => p.id).sort());
  });

  it("tags each piece with a meter and a key the score builder knows", () => {
    for (const piece of manifest.pieces) {
      expect(
        piece.tags.some((t) => /^\d+-\d+$/.test(t)),
        piece.id,
      ).toBe(true);
      expect(
        piece.tags.some((t) => /^[a-g][b#]?-(major|minor)$/.test(t)),
        piece.id,
      ).toBe(true);
    }
  });
});
