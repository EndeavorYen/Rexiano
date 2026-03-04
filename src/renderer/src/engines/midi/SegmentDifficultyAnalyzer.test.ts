import { describe, it, expect } from "vitest";
import { analyzeSegments } from "./SegmentDifficultyAnalyzer";
import type { ParsedSong, ParsedTrack } from "./types";

/** Minimal track input — only `notes` is typically needed */
type TrackInput = { notes?: ParsedTrack["notes"] } & Partial<
  Omit<ParsedTrack, "notes">
>;

/** Helper to create a minimal ParsedSong for testing */
function makeSong(
  overrides: Partial<Omit<ParsedSong, "tracks">> & {
    tracks?: TrackInput[];
  } = {},
): ParsedSong {
  const tracks: ParsedTrack[] = (overrides.tracks ?? []).map((t, i) => ({
    name: t.name ?? `Track ${i}`,
    instrument: t.instrument ?? "Piano",
    channel: t.channel ?? i,
    notes: t.notes ?? [],
  }));
  const allNotes = tracks.flatMap((t) => t.notes);
  return {
    fileName: overrides.fileName ?? "test.mid",
    duration: overrides.duration ?? 10,
    tracks,
    tempos: overrides.tempos ?? [{ time: 0, bpm: 120 }],
    timeSignatures: overrides.timeSignatures ?? [
      { time: 0, numerator: 4, denominator: 4 },
    ],
    keySignatures: overrides.keySignatures ?? [{ time: 0, key: 0, scale: 0 }],
    noteCount: overrides.noteCount ?? allNotes.length,
  };
}

describe("analyzeSegments", () => {
  it("returns empty array for an empty song", () => {
    const song = makeSong({ tracks: [], duration: 0 });
    expect(analyzeSegments(song)).toEqual([]);
  });

  it("returns empty array for a song with no notes", () => {
    const song = makeSong({ tracks: [{ notes: [] }], duration: 10 });
    expect(analyzeSegments(song)).toEqual([]);
  });

  it("returns empty array for zero or negative segment duration", () => {
    const notes = [
      { midi: 60, name: "C4", time: 0, duration: 1, velocity: 80 },
    ];
    const song = makeSong({ tracks: [{ notes }], duration: 10 });
    expect(analyzeSegments(song, 0)).toEqual([]);
    expect(analyzeSegments(song, -1)).toEqual([]);
  });

  it("divides a 10-second song into 5 segments of 2 seconds each", () => {
    const notes = Array.from({ length: 20 }, (_, i) => ({
      midi: 60 + (i % 12),
      name: "C4",
      time: i * 0.5,
      duration: 0.4,
      velocity: 80,
    }));
    const song = makeSong({ tracks: [{ notes }], duration: 10 });
    const segments = analyzeSegments(song, 2);

    expect(segments).toHaveLength(5);
    expect(segments[0].startTime).toBe(0);
    expect(segments[0].endTime).toBe(2);
    expect(segments[4].startTime).toBe(8);
    expect(segments[4].endTime).toBe(10);
  });

  it("handles non-evenly-divisible durations (last segment is shorter)", () => {
    const notes = [
      { midi: 60, name: "C4", time: 0, duration: 1, velocity: 80 },
    ];
    const song = makeSong({ tracks: [{ notes }], duration: 5 });
    const segments = analyzeSegments(song, 3);

    expect(segments).toHaveLength(2);
    expect(segments[0].startTime).toBe(0);
    expect(segments[0].endTime).toBe(3);
    expect(segments[1].startTime).toBe(3);
    expect(segments[1].endTime).toBe(5);
  });

  it("all difficulty scores are between 0 and 1", () => {
    const notes = Array.from({ length: 50 }, (_, i) => ({
      midi: 36 + (i % 48),
      name: "C4",
      time: i * 0.2,
      duration: 0.15,
      velocity: 100,
    }));
    const song = makeSong({ tracks: [{ notes }], duration: 10 });
    const segments = analyzeSegments(song, 2);

    for (const seg of segments) {
      expect(seg.difficulty).toBeGreaterThanOrEqual(0);
      expect(seg.difficulty).toBeLessThanOrEqual(1);
    }
  });

  it("dense sections score higher than sparse sections", () => {
    // First 2 seconds: 20 notes (dense). Last 2 seconds: 2 notes (sparse).
    const denseNotes = Array.from({ length: 20 }, (_, i) => ({
      midi: 60 + (i % 12),
      name: "C4",
      time: i * 0.1,
      duration: 0.08,
      velocity: 80,
    }));
    const sparseNotes = [
      { midi: 60, name: "C4", time: 8.0, duration: 0.5, velocity: 80 },
      { midi: 62, name: "D4", time: 9.0, duration: 0.5, velocity: 80 },
    ];
    const song = makeSong({
      tracks: [{ notes: [...denseNotes, ...sparseNotes] }],
      duration: 10,
    });
    const segments = analyzeSegments(song, 2);

    // First segment (dense) should be harder than last segment (sparse)
    const denseSegment = segments[0];
    const sparseSegment = segments[4];
    expect(denseSegment.difficulty).toBeGreaterThan(sparseSegment.difficulty);
  });

  it("segments with no notes have difficulty 0", () => {
    // Only notes in the first 2 seconds, nothing after
    const notes = Array.from({ length: 5 }, (_, i) => ({
      midi: 60,
      name: "C4",
      time: i * 0.3,
      duration: 0.2,
      velocity: 80,
    }));
    const song = makeSong({ tracks: [{ notes }], duration: 10 });
    const segments = analyzeSegments(song, 2);

    // Segments beyond the first should have difficulty 0
    expect(segments[2].difficulty).toBe(0);
    expect(segments[3].difficulty).toBe(0);
    expect(segments[4].difficulty).toBe(0);
  });

  it("multi-track songs with overlapping notes score higher for hand independence", () => {
    // Two tracks playing simultaneously
    const rightHand = Array.from({ length: 10 }, (_, i) => ({
      midi: 72 + (i % 5),
      name: "C5",
      time: i * 0.5,
      duration: 0.4,
      velocity: 80,
    }));
    const leftHand = Array.from({ length: 10 }, (_, i) => ({
      midi: 48 + (i % 5),
      name: "C3",
      time: i * 0.5 + 0.1, // offset to create overlap
      duration: 0.4,
      velocity: 70,
    }));

    const singleTrackSong = makeSong({
      tracks: [{ notes: [...rightHand, ...leftHand] }],
      duration: 6,
    });
    const multiTrackSong = makeSong({
      tracks: [{ notes: rightHand }, { notes: leftHand }],
      duration: 6,
    });

    const singleSegments = analyzeSegments(singleTrackSong, 6);
    const multiSegments = analyzeSegments(multiTrackSong, 6);

    // Multi-track should score higher due to hand independence component
    expect(multiSegments[0].difficulty).toBeGreaterThan(
      singleSegments[0].difficulty,
    );
  });

  it("returns consistent results for the same input", () => {
    const notes = Array.from({ length: 30 }, (_, i) => ({
      midi: 55 + (i % 20),
      name: "G3",
      time: i * 0.3,
      duration: 0.25,
      velocity: 75,
    }));
    const song = makeSong({ tracks: [{ notes }], duration: 10 });

    const r1 = analyzeSegments(song, 2);
    const r2 = analyzeSegments(song, 2);

    expect(r1).toEqual(r2);
  });

  it("respects custom segment duration", () => {
    const notes = Array.from({ length: 10 }, (_, i) => ({
      midi: 60,
      name: "C4",
      time: i,
      duration: 0.5,
      velocity: 80,
    }));
    const song = makeSong({ tracks: [{ notes }], duration: 10 });

    const segments1 = analyzeSegments(song, 1);
    const segments5 = analyzeSegments(song, 5);

    expect(segments1).toHaveLength(10);
    expect(segments5).toHaveLength(2);
  });
});
