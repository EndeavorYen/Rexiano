import {
  diagnoseParsedSong,
  summarizeMidiDiagnostics,
  type MidiDiagnostic,
  type MidiDiagnosticCode,
} from "@renderer/engines/midi/MidiDiagnostics";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type {
  NotationData,
  NotationWarning,
} from "@renderer/features/sheetMusic/types";

export type MidiDiagnosticNoticeCode =
  | MidiDiagnosticCode
  | "notation-rhythm-approximation";

export interface MidiDiagnosticNotice {
  kind: "warning" | "error";
  title: string;
  summary: string;
  canPractice: boolean;
  details: string[];
  diagnosticTitle: string;
  codes: MidiDiagnosticNoticeCode[];
}

export interface BuildMidiDiagnosticNoticeOptions {
  hasTimeSignatureMetadata?: boolean;
  notationData?: NotationData | null;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function buildMidiDiagnosticNotice(
  song: ParsedSong,
  options: BuildMidiDiagnosticNoticeOptions = {},
): MidiDiagnosticNotice | null {
  const diagnostics = filterMidiDiagnostics(diagnoseParsedSong(song), options);
  const summary = summarizeMidiDiagnostics(diagnostics);
  const notationWarnings = options.notationData?.warnings ?? [];
  if (summary.highestSeverity === "none" && notationWarnings.length === 0) {
    return null;
  }

  const kind = summary.errorCount > 0 ? "error" : "warning";
  const issueCount = summary.blockingCount || summary.warningCount;
  const midiDetails = diagnostics.map((diagnostic) => diagnostic.message);
  const notationDetails = buildNotationWarningDetails(
    notationWarnings,
    options.notationData ?? null,
  );
  const details = [...midiDetails, ...notationDetails];
  const codes: MidiDiagnosticNoticeCode[] = [...summary.codes];
  if (notationWarnings.length > 0) {
    codes.push("notation-rhythm-approximation");
  }

  return {
    kind,
    title: buildNoticeTitle(
      kind,
      summary.warningCount,
      notationWarnings.length,
    ),
    summary: buildNoticeSummary(
      kind,
      issueCount,
      summary.warningCount,
      notationWarnings.length,
    ),
    canPractice: summary.isPracticeReady,
    details,
    diagnosticTitle: details.join(" "),
    codes,
  };
}

function filterMidiDiagnostics(
  diagnostics: MidiDiagnostic[],
  options: BuildMidiDiagnosticNoticeOptions,
): MidiDiagnostic[] {
  if (!options.hasTimeSignatureMetadata) return diagnostics;
  return diagnostics.filter(
    (diagnostic) => diagnostic.code !== "missing-time-signature",
  );
}

function buildNoticeTitle(
  kind: MidiDiagnosticNotice["kind"],
  midiWarningCount: number,
  notationWarningCount: number,
): string {
  if (kind === "error") return "MIDI file is not practice-ready";
  if (notationWarningCount > 0 && midiWarningCount === 0) {
    return "Review sheet notation before practice";
  }
  if (notationWarningCount > 0) {
    return "Review MIDI and sheet quality before practice";
  }
  return "Review MIDI quality before practice";
}

function buildNoticeSummary(
  kind: MidiDiagnosticNotice["kind"],
  issueCount: number,
  midiWarningCount: number,
  notationWarningCount: number,
): string {
  if (kind === "error") {
    return `${issueCount} blocking MIDI ${pluralize(issueCount, "issue", "issues")} detected.`;
  }

  if (notationWarningCount > 0 && midiWarningCount === 0) {
    return `${notationWarningCount} notation rhythm ${pluralize(notationWarningCount, "approximation", "approximations")} detected.`;
  }

  if (notationWarningCount > 0) {
    const totalWarningCategories = midiWarningCount + 1;
    return `${totalWarningCategories} quality ${pluralize(totalWarningCategories, "warning", "warnings")} detected.`;
  }

  return `${issueCount} MIDI quality ${pluralize(issueCount, "warning", "warnings")} detected.`;
}

function buildNotationWarningDetails(
  warnings: readonly NotationWarning[],
  notationData: NotationData | null,
): string[] {
  if (warnings.length === 0) return [];

  const firstLocation = notationData
    ? describeNotationWarningLocation(warnings[0], notationData)
    : null;
  const locationText = firstLocation
    ? `; first at measure ${firstLocation.measure}, beat ${firstLocation.beat}`
    : "";

  return [
    `Sheet notation approximates ${warnings.length} unsupported ${pluralize(warnings.length, "rhythm", "rhythms")}${locationText}.`,
  ];
}

function describeNotationWarningLocation(
  warning: NotationWarning,
  notationData: NotationData,
): { measure: number; beat: number } | null {
  if (notationData.measures.length === 0) return null;

  let measureStartTick = 0;
  for (const measure of notationData.measures) {
    const beatTicks =
      notationData.ticksPerQuarter * (4 / measure.timeSignatureBottom);
    const measureTicks = measure.timeSignatureTop * beatTicks;
    const isInsideMeasure =
      warning.startTick >= measureStartTick &&
      warning.startTick < measureStartTick + measureTicks;
    const isLastMeasure =
      measure.index ===
      notationData.measures[notationData.measures.length - 1].index;

    if (isInsideMeasure || isLastMeasure) {
      const beat = Math.max(
        1,
        Math.floor((warning.startTick - measureStartTick) / beatTicks) + 1,
      );
      return {
        measure: measure.index + 1,
        beat,
      };
    }

    measureStartTick += measureTicks;
  }

  return null;
}
