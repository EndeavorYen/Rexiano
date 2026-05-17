import type { ParsedNote, ParsedSong } from "@renderer/engines/midi/types";

interface DenseRenderStressOptions {
  durationSeconds?: number;
  tracks?: number;
  eventsPerSecond?: number;
  chordSize?: number;
}

export type RenderStressDensity = "light" | "dense" | "extreme";

export interface RenderStressSummary {
  durationSeconds: number;
  trackCount: number;
  noteCount: number;
  notesPerSecond: number;
  maxTrackNoteCount: number;
  density: RenderStressDensity;
}

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

function midiToNoteName(midi: number): string {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

function roundTime(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function createDenseRenderStressSong({
  durationSeconds = 12,
  tracks = 4,
  eventsPerSecond = 16,
  chordSize = 10,
}: DenseRenderStressOptions = {}): ParsedSong {
  const eventCount = Math.floor(durationSeconds * eventsPerSecond);
  const noteDuration = roundTime(2 / eventsPerSecond);
  const parsedTracks = Array.from({ length: tracks }, (_, trackIndex) => {
    const notes: ParsedNote[] = [];

    for (let eventIndex = 0; eventIndex < eventCount; eventIndex++) {
      const time = roundTime(eventIndex / eventsPerSecond);
      for (let chordIndex = 0; chordIndex < chordSize; chordIndex++) {
        const midi = 48 + ((eventIndex + chordIndex * 3 + trackIndex * 5) % 36);
        notes.push({
          midi,
          name: midiToNoteName(midi),
          time,
          duration: noteDuration,
          velocity: 90,
        });
      }
    }

    return {
      name: `Dense Track ${trackIndex + 1}`,
      instrument: "Piano",
      channel: trackIndex % 16,
      notes,
    };
  });

  return {
    fileName: "dense-render-stress.mid",
    duration: durationSeconds,
    noteCount: parsedTracks.reduce((sum, track) => sum + track.notes.length, 0),
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    tracks: parsedTracks,
  };
}

function classifyStressDensity(notesPerSecond: number): RenderStressDensity {
  if (notesPerSecond >= 1200) return "extreme";
  if (notesPerSecond >= 300) return "dense";
  return "light";
}

export function summarizeRenderStressSong(
  song: ParsedSong,
): RenderStressSummary {
  const durationSeconds = Math.max(song.duration, 0);
  const notesPerSecond =
    durationSeconds > 0
      ? Math.round((song.noteCount / durationSeconds) * 100) / 100
      : 0;
  const maxTrackNoteCount = Math.max(
    0,
    ...song.tracks.map((track) => track.notes.length),
  );

  return {
    durationSeconds,
    trackCount: song.tracks.length,
    noteCount: song.noteCount,
    notesPerSecond,
    maxTrackNoteCount,
    density: classifyStressDensity(notesPerSecond),
  };
}
