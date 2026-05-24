import { describe, expect, it } from "vitest";
import { Midi } from "@tonejs/midi";
import {
  addNotesFromBeats,
  encodeMidiWithNotationHeaderMetadata,
  mergeGeneratedSongMetadata,
  type SongMeta,
} from "./generatedSongLibrary";

function songMeta(overrides: Partial<SongMeta> = {}): SongMeta {
  return {
    id: "hot-cross-buns",
    file: "hot-cross-buns.mid",
    title: "Hot Cross Buns",
    composer: "Traditional",
    difficulty: "beginner",
    category: "popular",
    durationSeconds: 14,
    tags: ["traditional", "melody", "c-major", "4-4", "level-0"],
    ...overrides,
  };
}

describe("generated song library helpers", () => {
  it("adds beat-based notes with exact notation-grid durations", () => {
    const midi = new Midi();
    midi.header.setTempo(120);
    const track = midi.addTrack();

    addNotesFromBeats(
      track,
      [
        [60, 0, 1],
        [62, 1, 0.5],
      ],
      120,
    );

    expect(track.notes.map((note) => note.durationTicks)).toEqual([480, 240]);
    expect(track.notes.map((note) => note.duration)).toEqual([0.5, 0.25]);
  });

  it("writes notation tags into MIDI header metadata", () => {
    const midi = new Midi();
    midi.header.setTempo(100);

    const bytes = encodeMidiWithNotationHeaderMetadata(midi, [
      "traditional",
      "d-major",
      "3-4",
    ]);

    const reparsed = new Midi(bytes);
    expect(reparsed.header.timeSignatures[0]).toMatchObject({
      ticks: 0,
      timeSignature: [3, 4],
    });
    expect(reparsed.header.keySignatures[0]).toMatchObject({
      ticks: 0,
      key: "D",
      scale: "major",
    });
  });

  it("preserves curated manifest grade, level tags, and existing-only songs", () => {
    const generated = [
      songMeta({
        durationSeconds: 15,
        tags: ["traditional", "melody", "c-major", "4-4"],
      }),
    ];
    const existing = [
      songMeta({
        grade: 0,
        tags: ["traditional", "melody", "c-major", "4-4", "level-0"],
      }),
      songMeta({
        id: "amazing-grace",
        file: "amazing-grace.mid",
        title: "Amazing Grace",
        difficulty: "intermediate",
        grade: 4,
        durationSeconds: 64,
        tags: ["traditional", "g-major", "3-4", "two-hands", "level-4"],
      }),
    ];

    const merged = mergeGeneratedSongMetadata(generated, existing);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "hot-cross-buns",
      grade: 0,
      durationSeconds: 15,
    });
    expect(merged[0].tags).toEqual([
      "traditional",
      "melody",
      "c-major",
      "4-4",
      "level-0",
    ]);
    expect(merged[1]).toEqual(existing[1]);
  });
});
