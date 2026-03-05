import { describe, it, expect } from "vitest";
import { analyzeDifficulty } from "./DifficultyAnalyzer";
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

describe("analyzeDifficulty", () => {
  it("returns grade 0 for an empty song", () => {
    const song = makeSong({ tracks: [], duration: 0 });
    const result = analyzeDifficulty(song);
    expect(result.grade).toBe(0);
    expect(result.factors.noteDensity).toBe(0);
    expect(result.factors.pitchRange).toBe(0);
    expect(result.factors.rhythmComplexity).toBe(0);
    expect(result.factors.tempo).toBe(0);
    expect(result.factors.handIndependence).toBe(0);
  });

  it("returns grade 0 for a song with no notes", () => {
    const song = makeSong({
      tracks: [{ notes: [] }],
      duration: 30,
    });
    const result = analyzeDifficulty(song);
    expect(result.grade).toBe(0);
  });

  it("gives a low grade (0-2) for a simple single-track slow song", () => {
    // 8 notes over 10 seconds, narrow range (C4-E4 = 4 semitones), slow tempo
    const notes = Array.from({ length: 8 }, (_, i) => ({
      midi: 60 + (i % 3), // C4, C#4, D4 — very narrow range
      name: "C4",
      time: i * 1.2,
      duration: 0.5,
      velocity: 80,
    }));
    const song = makeSong({
      tracks: [{ notes }],
      duration: 10,
      tempos: [{ time: 0, bpm: 80 }],
    });
    const result = analyzeDifficulty(song);
    expect(result.grade).toBeGreaterThanOrEqual(0);
    expect(result.grade).toBeLessThanOrEqual(2);
    expect(result.factors.noteDensity).toBeCloseTo(0.8, 1);
    expect(result.factors.pitchRange).toBe(2);
  });

  it("gives a medium grade (3-5) for moderate complexity", () => {
    // 40 notes over 10 seconds, 2-octave range, varied durations, moderate tempo
    const notes = Array.from({ length: 40 }, (_, i) => ({
      midi: 48 + (i % 24), // 2-octave span
      name: "C3",
      time: i * 0.25,
      duration: [0.1, 0.2, 0.3, 0.5, 0.75][i % 5], // 5 unique durations
      velocity: 80,
    }));
    const song = makeSong({
      tracks: [{ notes }],
      duration: 10,
      tempos: [{ time: 0, bpm: 120 }],
    });
    const result = analyzeDifficulty(song);
    expect(result.grade).toBeGreaterThanOrEqual(3);
    expect(result.grade).toBeLessThanOrEqual(5);
  });

  it("gives a high grade (6-8) for complex multi-track fast song", () => {
    // Dense notes across wide range, fast tempo, two independent tracks
    const rightHand = Array.from({ length: 80 }, (_, i) => ({
      midi: 60 + (i % 36), // 3-octave right hand
      name: "C4",
      time: i * 0.12,
      duration: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.08, 0.12][
        i % 10
      ],
      velocity: 100,
    }));
    const leftHand = Array.from({ length: 60 }, (_, i) => ({
      midi: 36 + (i % 24), // 2-octave left hand in bass range
      name: "C2",
      time: i * 0.15 + 0.05, // slightly offset from right hand
      duration: [0.3, 0.5, 0.2, 0.4, 0.6, 0.1, 0.15][i % 7],
      velocity: 70,
    }));
    const song = makeSong({
      tracks: [{ notes: rightHand }, { notes: leftHand }],
      duration: 10,
      tempos: [{ time: 0, bpm: 160 }],
    });
    const result = analyzeDifficulty(song);
    expect(result.grade).toBeGreaterThanOrEqual(6);
    expect(result.grade).toBeLessThanOrEqual(8);
    expect(result.factors.handIndependence).toBeGreaterThan(0);
  });

  it("computes hand independence as 0 for single-track songs", () => {
    const notes = Array.from({ length: 20 }, (_, i) => ({
      midi: 60 + i,
      name: "C4",
      time: i * 0.5,
      duration: 0.4,
      velocity: 80,
    }));
    const song = makeSong({
      tracks: [{ notes }],
      duration: 10,
    });
    const result = analyzeDifficulty(song);
    expect(result.factors.handIndependence).toBe(0);
  });

  it("uses default tempo (120) when no tempo events exist", () => {
    const notes = [
      { midi: 60, name: "C4", time: 0, duration: 1, velocity: 80 },
    ];
    const song = makeSong({
      tracks: [{ notes }],
      duration: 5,
      tempos: [],
    });
    const result = analyzeDifficulty(song);
    expect(result.factors.tempo).toBe(120);
  });

  it("computes weighted average BPM from multiple tempo events", () => {
    const notes = [
      { midi: 60, name: "C4", time: 0, duration: 1, velocity: 80 },
    ];
    // 5 seconds at 80 BPM, then 5 seconds at 160 BPM => avg 120
    const song = makeSong({
      tracks: [{ notes }],
      duration: 10,
      tempos: [
        { time: 0, bpm: 80 },
        { time: 5, bpm: 160 },
      ],
    });
    const result = analyzeDifficulty(song);
    expect(result.factors.tempo).toBeCloseTo(120, 0);
  });

  it("returns consistent results for the same input", () => {
    const notes = Array.from({ length: 30 }, (_, i) => ({
      midi: 55 + (i % 20),
      name: "G3",
      time: i * 0.3,
      duration: 0.25,
      velocity: 75,
    }));
    const song = makeSong({
      tracks: [{ notes }],
      duration: 10,
      tempos: [{ time: 0, bpm: 100 }],
    });
    const r1 = analyzeDifficulty(song);
    const r2 = analyzeDifficulty(song);
    expect(r1.grade).toBe(r2.grade);
    expect(r1.factors).toEqual(r2.factors);
  });
});
