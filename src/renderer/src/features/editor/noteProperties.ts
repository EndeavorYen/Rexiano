import type { EditableNotePatch } from "./editorCommands";
import type { EditableNote, EditableSong } from "./editorTypes";

export type NotePropertyValue =
  | { kind: "empty" }
  | { kind: "mixed" }
  | { kind: "value"; value: number };

export interface NotePropertyModel {
  selectedCount: number;
  pitch: NotePropertyValue;
  start: NotePropertyValue;
  duration: NotePropertyValue;
  velocity: NotePropertyValue;
  editableBatchFields: Array<"duration" | "velocity">;
}

export interface NotePropertyPatchInput {
  pitch?: number;
  start?: number;
  duration?: number;
  velocity?: number;
}

export interface NotePropertyPatchResult {
  patch: EditableNotePatch;
  warnings: string[];
}

const MIN_DURATION_SECONDS = 0.03125;

function resolveField(
  notes: EditableNote[],
  field: keyof Pick<EditableNote, "pitch" | "start" | "duration" | "velocity">,
): NotePropertyValue {
  if (notes.length === 0) return { kind: "empty" };

  const firstValue = notes[0][field];
  return notes.every((note) => note[field] === firstValue)
    ? { kind: "value", value: firstValue }
    : { kind: "mixed" };
}

function clampWithWarning(
  value: number | undefined,
  min: number,
  max: number,
  warning: string,
  warnings: string[],
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const clamped = Math.min(max, Math.max(min, value));
  if (clamped !== value) warnings.push(warning);
  return clamped;
}

export function getNotePropertyModel(
  song: EditableSong,
  selectedNoteIds: string[],
): NotePropertyModel {
  const idSet = new Set(selectedNoteIds);
  const notes = song.notes.filter((note) => idSet.has(note.id));
  return {
    selectedCount: notes.length,
    pitch: resolveField(notes, "pitch"),
    start: resolveField(notes, "start"),
    duration: resolveField(notes, "duration"),
    velocity: resolveField(notes, "velocity"),
    editableBatchFields: notes.length > 0 ? ["duration", "velocity"] : [],
  };
}

export function buildNotePropertyPatch(
  input: NotePropertyPatchInput,
): NotePropertyPatchResult {
  const warnings: string[] = [];
  const patch: EditableNotePatch = {};

  const pitch = clampWithWarning(
    input.pitch,
    0,
    127,
    "Pitch was clamped to the MIDI range 0-127.",
    warnings,
  );
  if (pitch !== undefined) patch.pitch = Math.round(pitch);

  const start = clampWithWarning(
    input.start,
    0,
    Number.MAX_SAFE_INTEGER,
    "Start time was clamped to 0 seconds or later.",
    warnings,
  );
  if (start !== undefined) patch.start = start;

  const duration = clampWithWarning(
    input.duration,
    MIN_DURATION_SECONDS,
    Number.MAX_SAFE_INTEGER,
    "Duration was clamped to at least 0.03125 seconds.",
    warnings,
  );
  if (duration !== undefined) patch.duration = duration;

  const velocity = clampWithWarning(
    input.velocity,
    1,
    127,
    "Velocity was clamped to the MIDI range 1-127.",
    warnings,
  );
  if (velocity !== undefined) patch.velocity = Math.round(velocity);

  return { patch, warnings };
}
