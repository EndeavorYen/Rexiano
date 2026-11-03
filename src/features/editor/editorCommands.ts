import type { EditableNote, EditableSong } from "./editorTypes";

export interface EditorCommand {
  label: string;
  apply: (song: EditableSong) => EditableSong;
  revert: (song: EditableSong) => EditableSong;
}

export interface EditorHistory {
  songId: string;
  undoStack: EditorCommand[];
  redoStack: EditorCommand[];
}

export type EditorCommandShortcut = "undo" | "redo" | "none";

export interface EditorCommandShortcutInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  isTypingTarget?: boolean;
}

export type EditableNotePatch = Partial<
  Pick<EditableNote, "pitch" | "start" | "duration" | "velocity" | "trackId">
>;

export function createEditorHistory(songId: string): EditorHistory {
  return {
    songId,
    undoStack: [],
    redoStack: [],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeNote(note: EditableNote): EditableNote {
  return {
    ...note,
    pitch: Math.round(clamp(note.pitch, 0, 127)),
    start: Math.max(0, note.start),
    duration: Math.max(0.03125, note.duration),
    velocity: Math.round(clamp(note.velocity, 1, 127)),
  };
}

function replaceNotes(song: EditableSong, notes: EditableNote[]): EditableSong {
  return {
    ...song,
    notes: notes.map(normalizeNote),
  };
}

function isHistoryForSong(history: EditorHistory, song: EditableSong): boolean {
  return history.songId === song.id;
}

function normalizeHistory(
  history: EditorHistory,
  song: EditableSong,
): EditorHistory {
  return isHistoryForSong(history, song)
    ? history
    : createEditorHistory(song.id);
}

export function executeEditorCommand(
  history: EditorHistory,
  song: EditableSong,
  command: EditorCommand,
): { song: EditableSong; history: EditorHistory } {
  const scopedHistory = normalizeHistory(history, song);
  return {
    song: command.apply(song),
    history: {
      songId: song.id,
      undoStack: [...scopedHistory.undoStack, command],
      redoStack: [],
    },
  };
}

export function undoEditorCommand(
  history: EditorHistory,
  song: EditableSong,
): { song: EditableSong; history: EditorHistory } {
  if (!isHistoryForSong(history, song)) {
    return { song, history: createEditorHistory(song.id) };
  }

  const command = history.undoStack.at(-1);
  if (!command) return { song, history };

  return {
    song: command.revert(song),
    history: {
      songId: song.id,
      undoStack: history.undoStack.slice(0, -1),
      redoStack: [command, ...history.redoStack],
    },
  };
}

export function redoEditorCommand(
  history: EditorHistory,
  song: EditableSong,
): { song: EditableSong; history: EditorHistory } {
  if (!isHistoryForSong(history, song)) {
    return { song, history: createEditorHistory(song.id) };
  }

  const command = history.redoStack[0];
  if (!command) return { song, history };

  return {
    song: command.apply(song),
    history: {
      songId: song.id,
      undoStack: [...history.undoStack, command],
      redoStack: history.redoStack.slice(1),
    },
  };
}

export function createAddNoteCommand(note: EditableNote): EditorCommand {
  const normalizedNote = normalizeNote(note);
  return {
    label: "Add note",
    apply: (song) => ({
      ...song,
      notes: [
        ...song.notes.filter((existing) => existing.id !== normalizedNote.id),
        normalizedNote,
      ],
    }),
    revert: (song) => ({
      ...song,
      notes: song.notes.filter((existing) => existing.id !== normalizedNote.id),
    }),
  };
}

export function createDeleteNotesCommand(
  song: EditableSong,
  noteIds: string[],
): EditorCommand {
  const idSet = new Set(noteIds);
  const beforeNotes = song.notes;
  const afterNotes = song.notes.filter((note) => !idSet.has(note.id));

  return {
    label: "Delete notes",
    apply: (currentSong) => replaceNotes(currentSong, afterNotes),
    revert: (currentSong) => replaceNotes(currentSong, beforeNotes),
  };
}

export function createMoveNotesCommand(
  song: EditableSong,
  noteIds: string[],
  delta: { startDelta?: number; pitchDelta?: number },
): EditorCommand {
  const idSet = new Set(noteIds);
  const beforeNotes = song.notes;
  const afterNotes = song.notes.map((note) =>
    idSet.has(note.id)
      ? normalizeNote({
          ...note,
          start: note.start + (delta.startDelta ?? 0),
          pitch: note.pitch + (delta.pitchDelta ?? 0),
        })
      : note,
  );

  return {
    label: "Move notes",
    apply: (currentSong) => replaceNotes(currentSong, afterNotes),
    revert: (currentSong) => replaceNotes(currentSong, beforeNotes),
  };
}

export function createUpdateNotesCommand(
  song: EditableSong,
  noteIds: string[],
  patch: EditableNotePatch,
): EditorCommand {
  const idSet = new Set(noteIds);
  const beforeNotes = song.notes;
  const afterNotes = song.notes.map((note) =>
    idSet.has(note.id) ? normalizeNote({ ...note, ...patch }) : note,
  );

  return {
    label: "Update notes",
    apply: (currentSong) => replaceNotes(currentSong, afterNotes),
    revert: (currentSong) => replaceNotes(currentSong, beforeNotes),
  };
}

export function resolveEditorCommandShortcut(
  input: EditorCommandShortcutInput,
): EditorCommandShortcut {
  if (input.isTypingTarget || input.altKey) return "none";
  if (!input.metaKey && !input.ctrlKey) return "none";

  const key = input.key.toLowerCase();
  if (key === "z" && input.shiftKey) return "redo";
  if (key === "z") return "undo";
  if (key === "y") return "redo";

  return "none";
}
