import { describe, expect, test } from "vitest";
import { Midi } from "@tonejs/midi";
import { parseMidiFile } from "@renderer/engines/midi/MidiFileParser";
import {
  createAddNoteCommand,
  createDeleteNotesCommand,
  createEditorHistory,
  createMoveNotesCommand,
  createUpdateNotesCommand,
  executeEditorCommand,
} from "./editorCommands";
import {
  buildMidiExportFileName,
  getMusicXmlExportBoundary,
  serializeEditableSongToMidiData,
} from "./midiExport";
import type { EditableSong } from "./editorTypes";

const editableSong: EditableSong = {
  id: "song-1",
  title: "Edited Song!",
  ppq: 480,
  tempoBpm: 96,
  tracks: [
    { id: "track-rh", name: "Right Hand", channel: 0, instrument: 0 },
    { id: "track-lh", name: "Left Hand", channel: 1, instrument: 1 },
  ],
  notes: [
    {
      id: "note-rh",
      trackId: "track-rh",
      pitch: 72,
      start: 0,
      duration: 0.5,
      velocity: 100,
    },
    {
      id: "note-lh",
      trackId: "track-lh",
      pitch: 48,
      start: 0.25,
      duration: 0.75,
      velocity: 64,
    },
  ],
};

describe("midiExport", () => {
  test("serializes editable songs to MIDI bytes that Rexiano can re-import", () => {
    const midiData = serializeEditableSongToMidiData(editableSong);
    const midi = new Midi(new Uint8Array(midiData));

    expect(midiData.length).toBeGreaterThan(0);
    expect(midi.tracks[1].instrument.number).toBe(1);
    const parsed = parseMidiFile("roundtrip.mid", midiData);

    expect(parsed.tempos[0]).toMatchObject({ bpm: 96 });
    expect(parsed.tracks).toHaveLength(2);
    expect(parsed.tracks[0]).toMatchObject({
      name: "Right Hand",
      channel: 0,
    });
    expect(parsed.tracks[1]).toMatchObject({
      name: "Left Hand",
      channel: 1,
    });
    expect(parsed.tracks.flatMap((track) => track.notes)).toMatchObject([
      { midi: 72, time: 0, duration: 0.5, velocity: 100 },
      { midi: 48, time: 0.25, duration: 0.75, velocity: 64 },
    ]);
  });

  test("builds a safe MIDI export filename", () => {
    expect(buildMidiExportFileName("Edited Song!")).toBe("Edited-Song.mid");
    expect(buildMidiExportFileName("")).toBe("rexiano-export.mid");
  });

  test("round-trips add, move, delete, and velocity edits", () => {
    const withExtraNote: EditableSong = {
      ...editableSong,
      notes: [
        ...editableSong.notes,
        {
          id: "delete-me",
          trackId: "track-rh",
          pitch: 76,
          start: 2,
          duration: 0.5,
          velocity: 70,
        },
      ],
    };
    let state = {
      song: withExtraNote,
      history: createEditorHistory(withExtraNote.id),
    };

    state = executeEditorCommand(
      state.history,
      state.song,
      createAddNoteCommand({
        id: "added-note",
        trackId: "track-rh",
        pitch: 79,
        start: 1.5,
        duration: 0.25,
        velocity: 90,
      }),
    );
    state = executeEditorCommand(
      state.history,
      state.song,
      createMoveNotesCommand(state.song, ["note-rh"], {
        startDelta: 0.5,
        pitchDelta: -12,
      }),
    );
    state = executeEditorCommand(
      state.history,
      state.song,
      createUpdateNotesCommand(state.song, ["note-lh"], { velocity: 72 }),
    );
    state = executeEditorCommand(
      state.history,
      state.song,
      createDeleteNotesCommand(state.song, ["delete-me"]),
    );

    const parsed = parseMidiFile(
      "edited-roundtrip.mid",
      serializeEditableSongToMidiData(state.song),
    );
    const notes = parsed.tracks
      .flatMap((track) => track.notes)
      .sort((a, b) => a.time - b.time || a.midi - b.midi);

    expect(notes).toMatchObject([
      { midi: 48, velocity: 72 },
      { midi: 60, time: 0.5 },
      { midi: 79, time: 1.5 },
    ]);
    expect(notes.some((note) => note.midi === 76)).toBe(false);
  });

  test("records the MusicXML boundary for a later dedicated slice", () => {
    expect(getMusicXmlExportBoundary()).toEqual({
      status: "deferred",
      reason:
        "MusicXML export needs notation-specific measure, voice, tie, and rest semantics beyond the piano-roll MIDI model.",
      followUp:
        "Track as a later notation-export issue after MIDI editing stabilizes.",
    });
  });
});
