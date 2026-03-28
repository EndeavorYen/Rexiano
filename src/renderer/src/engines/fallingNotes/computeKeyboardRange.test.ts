import { describe, it, expect } from "vitest";
import { computeKeyboardRange } from "./computeKeyboardRange";
import type { ParsedSong, ParsedTrack } from "../midi/types";

/** Helper to create a minimal ParsedSong with notes at given MIDI numbers. */
function makeSong(midiNotes: number[], trackCount = 1): ParsedSong {
  const notesPerTrack = Math.ceil(midiNotes.length / trackCount);
  const tracks: ParsedTrack[] = [];

  for (let t = 0; t < trackCount; t++) {
    const slice = midiNotes.slice(t * notesPerTrack, (t + 1) * notesPerTrack);
    tracks.push({
      name: `Track ${t}`,
      instrument: "Piano",
      notes: slice.map((midi) => ({
        midi,
        name: `N${midi}`,
        time: 0,
        duration: 0.5,
        velocity: 80,
      })),
      channel: t,
    });
  }

  return {
    fileName: "test.mid",
    duration: 10,
    tracks,
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    keySignatures: [],
    noteCount: midiNotes.length,
  } as ParsedSong;
}

describe("computeKeyboardRange", () => {
  it("G4(67)~D5(74) expands to at least 4 octaves centered on the range", () => {
    const song = makeSong([67, 74]); // G4, D5
    const range = computeKeyboardRange(song);
    // Must include the actual notes
    expect(range.firstNote).toBeLessThanOrEqual(67);
    expect(range.lastNote).toBeGreaterThanOrEqual(74);
    // Must be at least 4 octaves
    expect(range.lastNote - range.firstNote + 1).toBeGreaterThanOrEqual(48);
  });

  it("single note gets minimum 4 octaves", () => {
    const song = makeSong([60]); // C4 only
    const range = computeKeyboardRange(song);
    expect(range.lastNote - range.firstNote + 1).toBeGreaterThanOrEqual(48);
  });

  it("clamps to piano range 21-108", () => {
    // Notes near the very bottom of the piano
    const song = makeSong([21, 22, 23]);
    const range = computeKeyboardRange(song);
    expect(range.firstNote).toBeGreaterThanOrEqual(21);
    expect(range.lastNote).toBeLessThanOrEqual(108);
  });

  it("wide range C3~C6 works correctly", () => {
    const song = makeSong([48, 84]); // C3, C6
    const range = computeKeyboardRange(song);
    // Should include at least C3 to C6
    expect(range.firstNote).toBeLessThanOrEqual(48);
    expect(range.lastNote).toBeGreaterThanOrEqual(84);
  });

  it("null song returns full 88 keys", () => {
    const range = computeKeyboardRange(null);
    expect(range.firstNote).toBe(21);
    expect(range.lastNote).toBe(108);
  });

  it("empty song (no notes) returns full 88 keys", () => {
    const song = makeSong([]);
    const range = computeKeyboardRange(song);
    expect(range.firstNote).toBe(21);
    expect(range.lastNote).toBe(108);
  });

  it("multi-track scan finds min/max across all tracks", () => {
    // Track 0: C4(60), Track 1: C6(84)
    const song = makeSong([60, 84], 2);
    const range = computeKeyboardRange(song);
    expect(range.firstNote).toBeLessThanOrEqual(60);
    expect(range.lastNote).toBeGreaterThanOrEqual(84);
  });
});
