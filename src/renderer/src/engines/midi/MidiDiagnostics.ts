import type { ParsedNote, ParsedSong } from "./types";

export type MidiDiagnosticSeverity = "info" | "warning" | "error";

export type MidiDiagnosticCode =
  | "empty-song"
  | "missing-tempo"
  | "missing-time-signature"
  | "many-tracks"
  | "wide-chord-spread"
  | "missing-hand-metadata";

export interface MidiDiagnostic {
  code: MidiDiagnosticCode;
  severity: MidiDiagnosticSeverity;
  message: string;
  blocking: boolean;
  value?: number;
  threshold?: number;
}

export interface MidiDiagnosticOptions {
  maxPracticeTracks?: number;
  maxChordSpreadSeconds?: number;
  chordClusterWindowSeconds?: number;
}

const DEFAULT_OPTIONS: Required<MidiDiagnosticOptions> = {
  maxPracticeTracks: 6,
  maxChordSpreadSeconds: 0.05,
  chordClusterWindowSeconds: 0.1,
};

const HAND_METADATA_PATTERN =
  /\b(right|left|r\.?h\.?|l\.?h\.?|treble|bass|右手|左手)\b/i;

function roundSeconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function hasHandMetadata(song: ParsedSong): boolean {
  if (song.tracks.length <= 1) return true;
  return song.tracks.some((track) => HAND_METADATA_PATTERN.test(track.name));
}

function findMaxChordSpread(
  notes: ParsedNote[],
  clusterWindowSeconds: number,
): number {
  let maxSpread = 0;

  for (let i = 0; i < notes.length; i++) {
    const start = notes[i].time;
    let count = 1;
    let end = start;

    for (let j = i + 1; j < notes.length; j++) {
      if (notes[j].time - start > clusterWindowSeconds) break;
      count += 1;
      end = notes[j].time;
    }

    if (count >= 3) {
      maxSpread = Math.max(maxSpread, end - start);
    }
  }

  return roundSeconds(maxSpread);
}

function maxChordSpread(
  song: ParsedSong,
  clusterWindowSeconds: number,
): number {
  return song.tracks.reduce(
    (max, track) =>
      Math.max(max, findMaxChordSpread(track.notes, clusterWindowSeconds)),
    0,
  );
}

export function diagnoseParsedSong(
  song: ParsedSong,
  options: MidiDiagnosticOptions = {},
): MidiDiagnostic[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const diagnostics: MidiDiagnostic[] = [];

  if (song.noteCount === 0 || song.tracks.length === 0) {
    diagnostics.push({
      code: "empty-song",
      severity: "error",
      message: "No playable notes were found.",
      blocking: true,
    });
  }

  if (song.tempos.length === 0) {
    diagnostics.push({
      code: "missing-tempo",
      severity: "warning",
      message: "No tempo metadata was found.",
      blocking: false,
    });
  }

  if (song.timeSignatures.length === 0) {
    diagnostics.push({
      code: "missing-time-signature",
      severity: "warning",
      message: "No time signature metadata was found.",
      blocking: false,
    });
  }

  if (song.tracks.length > opts.maxPracticeTracks) {
    diagnostics.push({
      code: "many-tracks",
      severity: "warning",
      message: "This song has many tracks and may need practice setup.",
      blocking: false,
      value: song.tracks.length,
      threshold: opts.maxPracticeTracks,
    });
  }

  const chordSpread = maxChordSpread(song, opts.chordClusterWindowSeconds);
  if (chordSpread > opts.maxChordSpreadSeconds) {
    diagnostics.push({
      code: "wide-chord-spread",
      severity: "warning",
      message: "Chord notes are spread out enough to affect wait mode.",
      blocking: false,
      value: chordSpread,
      threshold: opts.maxChordSpreadSeconds,
    });
  }

  if (!hasHandMetadata(song)) {
    diagnostics.push({
      code: "missing-hand-metadata",
      severity: "warning",
      message: "Tracks do not identify left/right hand parts.",
      blocking: false,
    });
  }

  return diagnostics;
}
