import {
  diagnoseParsedSong,
  summarizeMidiDiagnostics,
  type MidiDiagnosticCode,
} from "@renderer/engines/midi/MidiDiagnostics";
import type { ParsedSong } from "@renderer/engines/midi/types";

export interface MidiDiagnosticNotice {
  kind: "warning" | "error";
  title: string;
  summary: string;
  canPractice: boolean;
  details: string[];
  diagnosticTitle: string;
  codes: MidiDiagnosticCode[];
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function buildMidiDiagnosticNotice(
  song: ParsedSong,
): MidiDiagnosticNotice | null {
  const diagnostics = diagnoseParsedSong(song);
  const summary = summarizeMidiDiagnostics(diagnostics);
  if (summary.highestSeverity === "none") return null;

  const kind = summary.errorCount > 0 ? "error" : "warning";
  const issueCount = summary.blockingCount || summary.warningCount;
  const details = diagnostics.map((diagnostic) => diagnostic.message);

  return {
    kind,
    title:
      kind === "error"
        ? "MIDI file is not practice-ready"
        : "Review MIDI quality before practice",
    summary:
      kind === "error"
        ? `${issueCount} blocking MIDI ${pluralize(issueCount, "issue", "issues")} detected.`
        : `${issueCount} MIDI quality ${pluralize(issueCount, "warning", "warnings")} detected.`,
    canPractice: summary.isPracticeReady,
    details,
    diagnosticTitle: details.join(" "),
    codes: summary.codes,
  };
}
