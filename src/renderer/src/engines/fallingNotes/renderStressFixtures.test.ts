import { describe, expect, test } from "vitest";
import {
  createDenseRenderStressSong,
  summarizeRenderStressSong,
} from "./renderStressFixtures";

describe("createDenseRenderStressSong", () => {
  test("creates deterministic dense passages with the expected note count", () => {
    const song = createDenseRenderStressSong({
      durationSeconds: 4,
      tracks: 3,
      eventsPerSecond: 8,
      chordSize: 6,
    });

    expect(song.fileName).toBe("dense-render-stress.mid");
    expect(song.duration).toBe(4);
    expect(song.tracks).toHaveLength(3);
    expect(song.noteCount).toBe(3 * 4 * 8 * 6);
    expect(song.tracks[0].notes[0]).toMatchObject({
      midi: 48,
      name: "C3",
      time: 0,
      duration: 0.25,
      velocity: 90,
    });
  });

  test("keeps notes sorted by time within every track", () => {
    const song = createDenseRenderStressSong({
      durationSeconds: 3,
      tracks: 2,
      eventsPerSecond: 10,
      chordSize: 8,
    });

    for (const track of song.tracks) {
      const times = track.notes.map((note) => note.time);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });

  test("summarizes dense fixture pressure deterministically", () => {
    const song = createDenseRenderStressSong({
      durationSeconds: 4,
      tracks: 4,
      eventsPerSecond: 20,
      chordSize: 10,
    });

    expect(summarizeRenderStressSong(song)).toEqual({
      durationSeconds: 4,
      trackCount: 4,
      noteCount: 3200,
      notesPerSecond: 800,
      maxTrackNoteCount: 800,
      density: "dense",
    });
  });

  test("classifies extreme stress fixtures separately from dense ones", () => {
    const song = createDenseRenderStressSong({
      durationSeconds: 2,
      tracks: 8,
      eventsPerSecond: 40,
      chordSize: 12,
    });

    expect(summarizeRenderStressSong(song)).toMatchObject({
      notesPerSecond: 3840,
      maxTrackNoteCount: 960,
      density: "extreme",
    });
  });
});
