import { describe, expect, test } from "vitest";
import { buildNotePropertyPatch, getNotePropertyModel } from "./noteProperties";
import type { EditableSong } from "./editorTypes";

const song: EditableSong = {
  id: "song-1",
  title: "Properties fixture",
  ppq: 480,
  tempoBpm: 120,
  tracks: [{ id: "track-1", name: "Piano", channel: 0 }],
  notes: [
    {
      id: "note-1",
      trackId: "track-1",
      pitch: 60,
      start: 0,
      duration: 0.5,
      velocity: 80,
    },
    {
      id: "note-2",
      trackId: "track-1",
      pitch: 64,
      start: 1,
      duration: 0.5,
      velocity: 92,
    },
  ],
};

describe("noteProperties", () => {
  test("returns exact fields for a single selected note", () => {
    expect(getNotePropertyModel(song, ["note-1"])).toEqual({
      selectedCount: 1,
      pitch: { kind: "value", value: 60 },
      start: { kind: "value", value: 0 },
      duration: { kind: "value", value: 0.5 },
      velocity: { kind: "value", value: 80 },
      editableBatchFields: ["duration", "velocity"],
    });
  });

  test("marks mixed fields for multiple selected notes", () => {
    expect(getNotePropertyModel(song, ["note-1", "note-2"])).toMatchObject({
      selectedCount: 2,
      pitch: { kind: "mixed" },
      start: { kind: "mixed" },
      duration: { kind: "value", value: 0.5 },
      velocity: { kind: "mixed" },
    });
  });

  test("returns empty model when nothing is selected", () => {
    expect(getNotePropertyModel(song, [])).toEqual({
      selectedCount: 0,
      pitch: { kind: "empty" },
      start: { kind: "empty" },
      duration: { kind: "empty" },
      velocity: { kind: "empty" },
      editableBatchFields: [],
    });
  });

  test("clamps numeric property patches and reports adjustments", () => {
    expect(
      buildNotePropertyPatch({
        pitch: 200,
        start: -1,
        duration: 0,
        velocity: 300,
      }),
    ).toEqual({
      patch: {
        pitch: 127,
        start: 0,
        duration: 0.03125,
        velocity: 127,
      },
      warnings: [
        "Pitch was clamped to the MIDI range 0-127.",
        "Start time was clamped to 0 seconds or later.",
        "Duration was clamped to at least 0.03125 seconds.",
        "Velocity was clamped to the MIDI range 1-127.",
      ],
    });
  });
});
