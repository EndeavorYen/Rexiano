import { describe, expect, test } from "vitest";
import {
  addNoteAtGridPoint,
  createEditableSongFromParsedSong,
  deleteNotesFromSong,
  getDefaultPianoRollGrid,
  moveNotesByGridDelta,
  resizeNotesByGridDelta,
  snapDeltaToGrid,
  snapTimeToGrid,
  xToSnappedTime,
  yToPitch,
} from "./pianoRollModel";
import type { ParsedSong } from "@renderer/engines/midi/types";

const parsedSong: ParsedSong = {
  fileName: "fixture.mid",
  duration: 3,
  tempos: [{ time: 0, bpm: 120 }],
  timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
  noteCount: 2,
  tracks: [
    {
      name: "Right hand",
      instrument: "Acoustic Grand Piano",
      channel: 0,
      notes: [
        { midi: 60, name: "C4", time: 0, duration: 0.5, velocity: 80 },
        { midi: 64, name: "E4", time: 1, duration: 0.5, velocity: 88 },
      ],
    },
  ],
};

describe("pianoRollModel", () => {
  test("snaps time and pointer coordinates deterministically", () => {
    const grid = getDefaultPianoRollGrid();

    expect(snapTimeToGrid(0.62, grid.snapSeconds)).toBe(0.5);
    expect(snapTimeToGrid(0.63, grid.snapSeconds)).toBe(0.75);
    expect(snapDeltaToGrid(-0.26, grid.snapSeconds)).toBe(-0.25);
    expect(xToSnappedTime(125, grid)).toBe(1.25);
    expect(yToPitch(0, grid)).toBe(84);
    expect(yToPitch(24, grid)).toBe(82);
  });

  test("converts parsed songs into a stable editable song model", () => {
    const editable = createEditableSongFromParsedSong(parsedSong);

    expect(editable).toMatchObject({
      id: "fixture.mid",
      title: "fixture.mid",
      ppq: 480,
      tempoBpm: 120,
      tracks: [{ id: "track-0", name: "Right hand", channel: 0 }],
    });
    expect(editable.notes).toEqual([
      {
        id: "track-0-note-0",
        trackId: "track-0",
        pitch: 60,
        start: 0,
        duration: 0.5,
        velocity: 80,
      },
      {
        id: "track-0-note-1",
        trackId: "track-0",
        pitch: 64,
        start: 1,
        duration: 0.5,
        velocity: 88,
      },
    ]);
  });

  test("adds notes from snapped grid coordinates", () => {
    const song = createEditableSongFromParsedSong(parsedSong);
    const grid = getDefaultPianoRollGrid();

    const edited = addNoteAtGridPoint(song, {
      id: "new-note",
      trackId: "track-0",
      x: 126,
      y: 288,
      grid,
    });

    expect(edited.notes.at(-1)).toMatchObject({
      id: "new-note",
      pitch: 60,
      start: 1.25,
      duration: grid.defaultDurationSeconds,
    });
  });

  test("moves, resizes, and deletes selected notes", () => {
    const song = createEditableSongFromParsedSong(parsedSong);
    const moved = moveNotesByGridDelta(song, ["track-0-note-0"], {
      startDelta: 0.26,
      pitchDelta: 2,
      snapSeconds: 0.25,
    });

    expect(moved.notes[0]).toMatchObject({ start: 0.25, pitch: 62 });

    const resized = resizeNotesByGridDelta(moved, ["track-0-note-0"], {
      durationDelta: 0.26,
      snapSeconds: 0.25,
    });
    expect(resized.notes[0]).toMatchObject({ duration: 0.75 });

    expect(deleteNotesFromSong(resized, ["track-0-note-0"]).notes).toEqual([
      song.notes[1],
    ]);
  });
});
