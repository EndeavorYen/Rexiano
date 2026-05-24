import { Midi } from "@tonejs/midi";
import {
  parseMidi,
  writeMidi,
  type MidiData,
  type MidiEvent,
  type MidiKeySignatureEvent,
} from "midi-file";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Category = "exercise" | "classical" | "popular" | "holiday";
export type Grade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface SongDef {
  id: string;
  file: string;
  title: string;
  composer: string;
  difficulty: Difficulty;
  category: Category;
  tags: string[];
  bpm: number;
  /** Build the MIDI object for this song. */
  build: () => Midi;
}

export interface SongMeta {
  id: string;
  file: string;
  title: string;
  composer: string;
  difficulty: Difficulty;
  category: Category;
  grade?: Grade;
  durationSeconds: number;
  tags: string[];
}

/**
 * [midiNote, startBeat, durationInBeats]
 * startBeat is 0-indexed. Duration in quarter-note beats.
 */
export type NoteEntry = [
  midi: number,
  startBeat: number,
  durationBeats: number,
];

const KEY_SIGNATURE_KEYS = [
  "Cb",
  "Gb",
  "Db",
  "Ab",
  "Eb",
  "Bb",
  "F",
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "C#",
] as const;

const KEY_SIGNATURE_BY_TAG = new Map<string, number>([
  ["c-major", 0],
  ["g-major", 1],
  ["d-major", 2],
  ["a-major", 3],
  ["e-major", 4],
  ["b-major", 5],
  ["f#-major", 6],
  ["c#-major", 7],
  ["f-major", -1],
  ["bb-major", -2],
  ["eb-major", -3],
  ["ab-major", -4],
  ["db-major", -5],
  ["gb-major", -6],
  ["cb-major", -7],
  ["a-minor", 0],
  ["e-minor", 1],
  ["b-minor", 2],
  ["f#-minor", 3],
  ["c#-minor", 4],
  ["g#-minor", 5],
  ["d#-minor", 6],
  ["a#-minor", 7],
  ["d-minor", -1],
  ["g-minor", -2],
  ["c-minor", -3],
  ["f-minor", -4],
  ["bb-minor", -5],
  ["eb-minor", -6],
  ["ab-minor", -7],
]);

export interface ParsedNotationTags {
  timeSignature?: [numerator: number, denominator: number];
  keySignature?: {
    accidentals: number;
    key: string;
    scale: "major" | "minor";
  };
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Convert beat-based note entries to time-based note events using BPM.
 */
export function addNotesFromBeats(
  track: ReturnType<Midi["addTrack"]>,
  notes: readonly NoteEntry[],
  bpm: number,
  velocity: number = 0.7,
): void {
  const secPerBeat = 60 / bpm;
  for (const [midi, startBeat, durBeats] of notes) {
    if (durBeats <= 0) continue;

    track.addNote({
      midi,
      time: startBeat * secPerBeat,
      duration: durBeats * secPerBeat,
      velocity,
    });
  }
}

export function parseNotationTags(tags: readonly string[]): ParsedNotationTags {
  const parsed: ParsedNotationTags = {};

  for (const rawTag of tags) {
    const tag = normalizeTag(rawTag);
    const timeMatch = /^(\d+)-(\d+)$/.exec(tag);
    if (timeMatch && !parsed.timeSignature) {
      const numerator = Number(timeMatch[1]);
      const denominator = Number(timeMatch[2]);
      if (Number.isInteger(numerator) && Number.isInteger(denominator)) {
        parsed.timeSignature = [numerator, denominator];
      }
      continue;
    }

    const accidentals = KEY_SIGNATURE_BY_TAG.get(tag);
    if (accidentals !== undefined && !parsed.keySignature) {
      parsed.keySignature = {
        accidentals,
        key: KEY_SIGNATURE_KEYS[accidentals + 7],
        scale: tag.endsWith("-minor") ? "minor" : "major",
      };
    }
  }

  return parsed;
}

export function applyNotationHeaderMetadata(
  midi: Midi,
  tags: readonly string[],
): void {
  const metadata = parseNotationTags(tags);

  if (metadata.timeSignature) {
    midi.header.timeSignatures = midi.header.timeSignatures.filter(
      (timeSignature) => timeSignature.ticks !== 0,
    );
    midi.header.timeSignatures.unshift({
      ticks: 0,
      timeSignature: metadata.timeSignature,
    });
  }

  if (metadata.keySignature) {
    midi.header.keySignatures = midi.header.keySignatures.filter(
      (keySignature) => keySignature.ticks !== 0,
    );
    midi.header.keySignatures.unshift({
      ticks: 0,
      key: metadata.keySignature.key,
      scale: metadata.keySignature.scale,
    });
  }

  midi.header.update();
}

function keySignatureEvent(
  metadata: NonNullable<ParsedNotationTags["keySignature"]>,
): MidiKeySignatureEvent {
  return {
    deltaTime: 0,
    key: metadata.accidentals,
    meta: true,
    scale: metadata.scale === "major" ? 0 : 1,
    type: "keySignature",
  };
}

function replaceInitialKeySignature(
  data: MidiData,
  metadata: NonNullable<ParsedNotationTags["keySignature"]>,
): MidiData {
  const track = data.tracks[0] ?? [];
  const replacement = keySignatureEvent(metadata);
  let absoluteTime = 0;
  let inserted = false;
  const patchedTrack: MidiEvent[] = [];

  for (const event of track) {
    absoluteTime += event.deltaTime;
    if (event.type === "keySignature" && absoluteTime === 0) {
      if (!inserted) {
        patchedTrack.push({ ...replacement, deltaTime: event.deltaTime });
        inserted = true;
      }
      continue;
    }

    patchedTrack.push(event);
  }

  if (!inserted) {
    patchedTrack.unshift(replacement);
  }

  data.tracks[0] = patchedTrack;
  return data;
}

export function encodeMidiWithNotationHeaderMetadata(
  midi: Midi,
  tags: readonly string[],
): Uint8Array {
  applyNotationHeaderMetadata(midi, tags);

  const metadata = parseNotationTags(tags);
  const bytes = midi.toArray();
  if (!metadata.keySignature) return bytes;

  const data = replaceInitialKeySignature(
    parseMidi(bytes),
    metadata.keySignature,
  );
  return new Uint8Array(writeMidi(data));
}

export function computeMidiDurationSeconds(midi: Midi): number {
  let maxEndTime = 0;
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      const end = note.time + note.duration;
      if (end > maxEndTime) maxEndTime = end;
    }
  }
  return Math.ceil(maxEndTime);
}

export function createSongMetaFromDefinition(
  def: Omit<SongDef, "build">,
  midi: Midi,
): SongMeta {
  return {
    id: def.id,
    file: def.file,
    title: def.title,
    composer: def.composer,
    difficulty: def.difficulty,
    category: def.category,
    durationSeconds: computeMidiDurationSeconds(midi),
    tags: [...def.tags],
  };
}

function mergeTags(
  curatedTags: readonly string[],
  generatedTags: readonly string[],
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const tag of [...curatedTags, ...generatedTags]) {
    const normalized = normalizeTag(tag);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(tag);
  }

  return merged;
}

function mergeGeneratedEntry(
  generated: SongMeta,
  existing: SongMeta,
): SongMeta {
  return {
    ...generated,
    title: existing.title || generated.title,
    composer: existing.composer || generated.composer,
    grade: existing.grade ?? generated.grade,
    tags: mergeTags(existing.tags, generated.tags),
  };
}

export function mergeGeneratedSongMetadata(
  generatedSongs: readonly SongMeta[],
  existingSongs: readonly SongMeta[],
): SongMeta[] {
  if (existingSongs.length === 0) {
    return generatedSongs.map((song) => ({
      ...song,
      tags: [...song.tags],
    }));
  }

  const generatedById = new Map(
    generatedSongs.map((song) => [song.id, song] as const),
  );
  const seenIds = new Set<string>();
  const merged = existingSongs.map((existing) => {
    const generated = generatedById.get(existing.id);
    seenIds.add(existing.id);
    return generated
      ? mergeGeneratedEntry(generated, existing)
      : { ...existing, tags: [...existing.tags] };
  });

  for (const generated of generatedSongs) {
    if (!seenIds.has(generated.id)) {
      merged.push({ ...generated, tags: [...generated.tags] });
    }
  }

  return merged;
}
