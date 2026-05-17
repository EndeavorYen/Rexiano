import type { ParsedNote, ParsedSong } from "./types";

export type MidiDiagnosticSeverity = "info" | "warning" | "error";

export type MidiDiagnosticCode =
  | "empty-song"
  | "missing-tempo"
  | "missing-time-signature"
  | "many-tracks"
  | "loose-quantization"
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

export interface MidiDiagnosticSummary {
  isPracticeReady: boolean;
  hasWarnings: boolean;
  highestSeverity: MidiDiagnosticSeverity | "none";
  blockingCount: number;
  warningCount: number;
  errorCount: number;
  codes: MidiDiagnosticCode[];
}

export interface MidiDiagnosticOptions {
  maxPracticeTracks?: number;
  quantizationGridSeconds?: number;
  maxQuantizationDriftSeconds?: number;
  maxOffGridNoteRatio?: number;
  maxChordSpreadSeconds?: number;
  chordClusterWindowSeconds?: number;
}

export type MidiAuthoringChecklistItemId =
  | "playable-notes"
  | "tempo"
  | "time-signature"
  | "hand-metadata"
  | "track-count"
  | "quantization"
  | "chord-timing";

export type MidiAuthoringChecklistStatus = "pass" | "review" | "fix";

export interface MidiAuthoringChecklistItem {
  id: MidiAuthoringChecklistItemId;
  status: MidiAuthoringChecklistStatus;
  severity: MidiDiagnosticSeverity;
  message: string;
}

export interface MidiAuthoringChecklist {
  isPracticeReady: boolean;
  blockingCount: number;
  warningCount: number;
  items: MidiAuthoringChecklistItem[];
}

const DEFAULT_OPTIONS: Required<MidiDiagnosticOptions> = {
  maxPracticeTracks: 6,
  quantizationGridSeconds: 0.125,
  maxQuantizationDriftSeconds: 0.015,
  maxOffGridNoteRatio: 0.35,
  maxChordSpreadSeconds: 0.05,
  chordClusterWindowSeconds: 0.1,
};

const HAND_METADATA_PATTERN =
  /\b(right|left|r\.?h\.?|l\.?h\.?|treble|bass|右手|左手)\b/i;

function roundSeconds(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

function hasHandMetadata(song: ParsedSong): boolean {
  if (song.tracks.length <= 1) return true;
  return song.tracks.some((track) => HAND_METADATA_PATTERN.test(track.name));
}

function distanceToNearestGrid(time: number, gridSeconds: number): number {
  if (gridSeconds <= 0) return 0;

  return Math.abs(time - Math.round(time / gridSeconds) * gridSeconds);
}

function offGridNoteRatio(
  song: ParsedSong,
  gridSeconds: number,
  maxDriftSeconds: number,
): number {
  let noteCount = 0;
  let offGridCount = 0;

  for (const track of song.tracks) {
    for (const note of track.notes) {
      noteCount += 1;
      if (distanceToNearestGrid(note.time, gridSeconds) > maxDriftSeconds) {
        offGridCount += 1;
      }
    }
  }

  return noteCount > 0 ? roundRatio(offGridCount / noteCount) : 0;
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

function diagnosticByCode(
  diagnostics: MidiDiagnostic[],
): Map<MidiDiagnosticCode, MidiDiagnostic> {
  return new Map(
    diagnostics.map((diagnostic) => [diagnostic.code, diagnostic]),
  );
}

function checklistItem(
  diagnosticsByCode: Map<MidiDiagnosticCode, MidiDiagnostic>,
  code: MidiDiagnosticCode,
  passItem: MidiAuthoringChecklistItem,
  failItem: Omit<MidiAuthoringChecklistItem, "severity">,
): MidiAuthoringChecklistItem {
  const diagnostic = diagnosticsByCode.get(code);
  if (!diagnostic) return passItem;

  return {
    ...failItem,
    severity: diagnostic.severity,
  };
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

  const offGridRatio = offGridNoteRatio(
    song,
    opts.quantizationGridSeconds,
    opts.maxQuantizationDriftSeconds,
  );
  if (offGridRatio > opts.maxOffGridNoteRatio) {
    diagnostics.push({
      code: "loose-quantization",
      severity: "warning",
      message: "Many note starts are off the expected quantization grid.",
      blocking: false,
      value: offGridRatio,
      threshold: opts.maxOffGridNoteRatio,
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

export function summarizeMidiDiagnostics(
  diagnostics: MidiDiagnostic[],
): MidiDiagnosticSummary {
  const blockingCount = diagnostics.filter((d) => d.blocking).length;
  const warningCount = diagnostics.filter(
    (d) => d.severity === "warning",
  ).length;
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const highestSeverity: MidiDiagnosticSummary["highestSeverity"] =
    errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "none";

  return {
    isPracticeReady: blockingCount === 0,
    hasWarnings: warningCount > 0,
    highestSeverity,
    blockingCount,
    warningCount,
    errorCount,
    codes: diagnostics.map((d) => d.code),
  };
}

export function buildMidiAuthoringChecklist(
  song: ParsedSong,
  options: MidiDiagnosticOptions = {},
): MidiAuthoringChecklist {
  const diagnostics = diagnoseParsedSong(song, options);
  const summary = summarizeMidiDiagnostics(diagnostics);
  const diagnosticsByCode = diagnosticByCode(diagnostics);

  return {
    isPracticeReady: summary.isPracticeReady,
    blockingCount: summary.blockingCount,
    warningCount: summary.warningCount,
    items: [
      checklistItem(
        diagnosticsByCode,
        "empty-song",
        {
          id: "playable-notes",
          status: "pass",
          severity: "info",
          message: "Playable notes are present.",
        },
        {
          id: "playable-notes",
          status: "fix",
          message: "Add playable notes before contributing this song.",
        },
      ),
      checklistItem(
        diagnosticsByCode,
        "missing-tempo",
        {
          id: "tempo",
          status: "pass",
          severity: "info",
          message: "Tempo metadata is present.",
        },
        {
          id: "tempo",
          status: "fix",
          message: "Add tempo metadata before contributing this song.",
        },
      ),
      checklistItem(
        diagnosticsByCode,
        "missing-time-signature",
        {
          id: "time-signature",
          status: "pass",
          severity: "info",
          message: "Time signature metadata is present.",
        },
        {
          id: "time-signature",
          status: "fix",
          message: "Add time signature metadata before contributing this song.",
        },
      ),
      checklistItem(
        diagnosticsByCode,
        "missing-hand-metadata",
        {
          id: "hand-metadata",
          status: "pass",
          severity: "info",
          message: "Track names identify hand parts where needed.",
        },
        {
          id: "hand-metadata",
          status: "fix",
          message: "Name tracks with left/right hand metadata.",
        },
      ),
      checklistItem(
        diagnosticsByCode,
        "many-tracks",
        {
          id: "track-count",
          status: "pass",
          severity: "info",
          message: "Track count is within the practice-ready range.",
        },
        {
          id: "track-count",
          status: "review",
          message: "Reduce or classify extra tracks before practice.",
        },
      ),
      checklistItem(
        diagnosticsByCode,
        "loose-quantization",
        {
          id: "quantization",
          status: "pass",
          severity: "info",
          message: "Note starts are aligned to the expected grid.",
        },
        {
          id: "quantization",
          status: "review",
          message: "Quantize off-grid note starts before contributing.",
        },
      ),
      checklistItem(
        diagnosticsByCode,
        "wide-chord-spread",
        {
          id: "chord-timing",
          status: "pass",
          severity: "info",
          message: "Chord timing is tight enough for wait mode.",
        },
        {
          id: "chord-timing",
          status: "review",
          message: "Quantize loose chord timing for wait mode.",
        },
      ),
    ],
  };
}
