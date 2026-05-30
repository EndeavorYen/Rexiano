import { describe, expect, test } from "vitest";
import {
  createAddNoteCommand,
  createDeleteNotesCommand,
  createEditorHistory,
  createMoveNotesCommand,
  createUpdateNotesCommand,
  executeEditorCommand,
  redoEditorCommand,
  resolveEditorCommandShortcut,
  undoEditorCommand,
} from "./editorCommands";
import type { EditableSong } from "./editorTypes";

const baseSong: EditableSong = {
  id: "song-1",
  title: "Editor test song",
  ppq: 480,
  tempoBpm: 120,
  tracks: [{ id: "track-1", name: "Piano", channel: 0 }],
  notes: [
    {
      id: "note-1",
      trackId: "track-1",
      pitch: 60,
      start: 0,
      duration: 1,
      velocity: 80,
    },
    {
      id: "note-2",
      trackId: "track-1",
      pitch: 64,
      start: 1,
      duration: 0.5,
      velocity: 88,
    },
  ],
};

describe("editorCommands", () => {
  test("executes add -> undo -> redo deterministically", () => {
    const newNote = {
      id: "note-3",
      trackId: "track-1",
      pitch: 67,
      start: 2,
      duration: 0.5,
      velocity: 90,
    };
    const history = createEditorHistory(baseSong.id);

    const added = executeEditorCommand(
      history,
      baseSong,
      createAddNoteCommand(newNote),
    );
    expect(added.song.notes.map((note) => note.id)).toEqual([
      "note-1",
      "note-2",
      "note-3",
    ]);

    const undone = undoEditorCommand(added.history, added.song);
    expect(undone.song.notes.map((note) => note.id)).toEqual([
      "note-1",
      "note-2",
    ]);

    const redone = redoEditorCommand(undone.history, undone.song);
    expect(redone.song.notes.map((note) => note.id)).toEqual([
      "note-1",
      "note-2",
      "note-3",
    ]);
  });

  test("undoes multi-note move commands", () => {
    const moved = executeEditorCommand(
      createEditorHistory(baseSong.id),
      baseSong,
      createMoveNotesCommand(baseSong, ["note-1", "note-2"], {
        startDelta: 0.25,
        pitchDelta: 12,
      }),
    );

    expect(moved.song.notes).toMatchObject([
      { id: "note-1", start: 0.25, pitch: 72 },
      { id: "note-2", start: 1.25, pitch: 76 },
    ]);

    const undone = undoEditorCommand(moved.history, moved.song);
    expect(undone.song.notes).toEqual(baseSong.notes);
  });

  test("undoes delete commands and preserves deleted note order", () => {
    const deleted = executeEditorCommand(
      createEditorHistory(baseSong.id),
      baseSong,
      createDeleteNotesCommand(baseSong, ["note-1", "note-2"]),
    );

    expect(deleted.song.notes).toEqual([]);
    expect(undoEditorCommand(deleted.history, deleted.song).song.notes).toEqual(
      baseSong.notes,
    );
  });

  test("undoes property updates for multiple notes", () => {
    const updated = executeEditorCommand(
      createEditorHistory(baseSong.id),
      baseSong,
      createUpdateNotesCommand(baseSong, ["note-1", "note-2"], {
        velocity: 72,
        duration: 0.75,
      }),
    );

    expect(updated.song.notes).toMatchObject([
      { id: "note-1", velocity: 72, duration: 0.75 },
      { id: "note-2", velocity: 72, duration: 0.75 },
    ]);
    expect(undoEditorCommand(updated.history, updated.song).song.notes).toEqual(
      baseSong.notes,
    );
  });

  test("clears redo history after a new edit", () => {
    const first = executeEditorCommand(
      createEditorHistory(baseSong.id),
      baseSong,
      createDeleteNotesCommand(baseSong, ["note-2"]),
    );
    const undone = undoEditorCommand(first.history, first.song);
    expect(undone.history.redoStack).toHaveLength(1);

    const second = executeEditorCommand(
      undone.history,
      undone.song,
      createDeleteNotesCommand(undone.song, ["note-1"]),
    );
    expect(second.history.redoStack).toHaveLength(0);
  });

  test("does not carry command history across songs", () => {
    const edited = executeEditorCommand(
      createEditorHistory(baseSong.id),
      baseSong,
      createDeleteNotesCommand(baseSong, ["note-2"]),
    );
    const differentSong = { ...baseSong, id: "song-2" };

    const result = undoEditorCommand(edited.history, differentSong);

    expect(result.song).toBe(differentSong);
    expect(result.history).toEqual(createEditorHistory("song-2"));
  });

  test("maps platform undo and redo shortcuts", () => {
    expect(resolveEditorCommandShortcut({ key: "z", metaKey: true })).toBe(
      "undo",
    );
    expect(
      resolveEditorCommandShortcut({ key: "z", metaKey: true, shiftKey: true }),
    ).toBe("redo");
    expect(resolveEditorCommandShortcut({ key: "y", ctrlKey: true })).toBe(
      "redo",
    );
  });

  test("ignores command shortcuts while typing", () => {
    expect(
      resolveEditorCommandShortcut({
        key: "z",
        metaKey: true,
        isTypingTarget: true,
      }),
    ).toBe("none");
  });
});
