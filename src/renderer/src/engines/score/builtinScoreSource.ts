import { isScoreImportPath } from "@shared/practiceImportFile";

export function builtinScoreFileName(songId: string): string {
  return `${songId}.musicxml`;
}

export type BuiltinSongSource = "score" | "midi";

export function resolveBuiltinSongSource(args: {
  songId: string;
  scorePresent: boolean;
}): BuiltinSongSource {
  void args.songId;
  return args.scorePresent ? "score" : "midi";
}

export function practiceSourceFromFileName(fileName: string): BuiltinSongSource {
  return isScoreImportPath(fileName) ? "score" : "midi";
}

/** Score-backed songs should show the staff; MIDI-backed keep falling notes. */
export function preferredDisplayModeForSource(
  source: BuiltinSongSource,
): "split" | "falling" {
  return source === "score" ? "split" : "falling";
}

export function builtinOriginLabelKey(
  source: BuiltinSongSource,
): "library.origin.score" | "library.origin.midi" {
  return source === "score" ? "library.origin.score" : "library.origin.midi";
}

export function sheetFidelityLabelKey(
  source: BuiltinSongSource,
): "sheetMusic.fidelity.score" | "sheetMusic.fidelity.approximate" {
  return source === "score"
    ? "sheetMusic.fidelity.score"
    : "sheetMusic.fidelity.approximate";
}
