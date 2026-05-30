import type { ParsedSong } from "@renderer/engines/midi/types";
import type { EditableNote, EditableSong } from "./editorTypes";

export interface PianoRollGrid {
  snapSeconds: number;
  pixelsPerSecond: number;
  rowHeight: number;
  minPitch: number;
  maxPitch: number;
  defaultDurationSeconds: number;
  defaultVelocity: number;
}

export interface GridPointNoteInput {
  id: string;
  trackId: string;
  x: number;
  y: number;
  grid: PianoRollGrid;
}

export function getDefaultPianoRollGrid(): PianoRollGrid {
  return {
    snapSeconds: 0.25,
    pixelsPerSecond: 100,
    rowHeight: 12,
    minPitch: 21,
    maxPitch: 84,
    defaultDurationSeconds: 0.5,
    defaultVelocity: 80,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function snapTimeToGrid(time: number, snapSeconds: number): number {
  if (snapSeconds <= 0) return Math.max(0, time);
  return Math.max(0, Math.round(time / snapSeconds) * snapSeconds);
}

export function snapDeltaToGrid(delta: number, snapSeconds: number): number {
  if (snapSeconds <= 0) return delta;
  return Math.round(delta / snapSeconds) * snapSeconds;
}

export function xToSnappedTime(x: number, grid: PianoRollGrid): number {
  return snapTimeToGrid(x / grid.pixelsPerSecond, grid.snapSeconds);
}

export function timeToX(time: number, grid: PianoRollGrid): number {
  return time * grid.pixelsPerSecond;
}

export function yToPitch(y: number, grid: PianoRollGrid): number {
  const row = Math.floor(Math.max(0, y) / grid.rowHeight);
  return Math.round(clamp(grid.maxPitch - row, grid.minPitch, grid.maxPitch));
}

export function pitchToY(pitch: number, grid: PianoRollGrid): number {
  return (
    (grid.maxPitch - clamp(pitch, grid.minPitch, grid.maxPitch)) *
    grid.rowHeight
  );
}

export function createEditableSongFromParsedSong(
  parsedSong: ParsedSong,
): EditableSong {
  const tracks = parsedSong.tracks.map((track, trackIndex) => ({
    id: `track-${trackIndex}`,
    name: track.name || `Track ${trackIndex + 1}`,
    channel: track.channel,
  }));
  const notes = parsedSong.tracks.flatMap((track, trackIndex) =>
    track.notes.map((note, noteIndex) => ({
      id: `track-${trackIndex}-note-${noteIndex}`,
      trackId: `track-${trackIndex}`,
      pitch: note.midi,
      start: note.time,
      duration: note.duration,
      velocity: note.velocity,
    })),
  );

  return {
    id: parsedSong.fileName,
    title: parsedSong.fileName,
    ppq: 480,
    tempoBpm: parsedSong.tempos[0]?.bpm ?? 120,
    tracks,
    notes: sortNotes(notes),
  };
}

export function createNoteFromGridPoint(
  input: GridPointNoteInput,
): EditableNote {
  return {
    id: input.id,
    trackId: input.trackId,
    pitch: yToPitch(input.y, input.grid),
    start: xToSnappedTime(input.x, input.grid),
    duration: input.grid.defaultDurationSeconds,
    velocity: input.grid.defaultVelocity,
  };
}

export function addNoteAtGridPoint(
  song: EditableSong,
  input: GridPointNoteInput,
): EditableSong {
  const note = createNoteFromGridPoint(input);

  return {
    ...song,
    notes: sortNotes([
      ...song.notes.filter((existing) => existing.id !== note.id),
      note,
    ]),
  };
}

export function moveNotesByGridDelta(
  song: EditableSong,
  noteIds: string[],
  delta: { startDelta: number; pitchDelta: number; snapSeconds: number },
): EditableSong {
  const idSet = new Set(noteIds);
  const snappedDelta = snapDeltaToGrid(delta.startDelta, delta.snapSeconds);
  return {
    ...song,
    notes: sortNotes(
      song.notes.map((note) =>
        idSet.has(note.id)
          ? {
              ...note,
              start: snapTimeToGrid(
                note.start + snappedDelta,
                delta.snapSeconds,
              ),
              pitch: Math.round(clamp(note.pitch + delta.pitchDelta, 0, 127)),
            }
          : note,
      ),
    ),
  };
}

export function resizeNotesByGridDelta(
  song: EditableSong,
  noteIds: string[],
  delta: { durationDelta: number; snapSeconds: number },
): EditableSong {
  const idSet = new Set(noteIds);
  const snappedDelta = snapDeltaToGrid(delta.durationDelta, delta.snapSeconds);
  return {
    ...song,
    notes: sortNotes(
      song.notes.map((note) =>
        idSet.has(note.id)
          ? {
              ...note,
              duration: Math.max(
                delta.snapSeconds,
                snapTimeToGrid(note.duration + snappedDelta, delta.snapSeconds),
              ),
            }
          : note,
      ),
    ),
  };
}

export function deleteNotesFromSong(
  song: EditableSong,
  noteIds: string[],
): EditableSong {
  const idSet = new Set(noteIds);
  return {
    ...song,
    notes: song.notes.filter((note) => !idSet.has(note.id)),
  };
}

function sortNotes(notes: EditableNote[]): EditableNote[] {
  return [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}
