/**
 * Pure utility functions extracted from SheetMusicPanel for testability.
 *
 * These functions have no React or DOM dependencies and can be unit tested
 * independently. Previously they were private to SheetMusicPanel.tsx.
 */

/** Key-signature defaults by note letter. */
export const KEY_SIGNATURE_DEFAULTS: Record<string, Record<string, string>> = {
  C: {},
  G: { F: "#" },
  D: { F: "#", C: "#" },
  A: { F: "#", C: "#", G: "#" },
  E: { F: "#", C: "#", G: "#", D: "#" },
  B: { F: "#", C: "#", G: "#", D: "#", A: "#" },
  "F#": { F: "#", C: "#", G: "#", D: "#", A: "#", E: "#" },
  "C#": { F: "#", C: "#", G: "#", D: "#", A: "#", E: "#", B: "#" },
  F: { B: "b" },
  Bb: { B: "b", E: "b" },
  Eb: { B: "b", E: "b", A: "b" },
  Ab: { B: "b", E: "b", A: "b", D: "b" },
  Db: { B: "b", E: "b", A: "b", D: "b", G: "b" },
  Gb: { B: "b", E: "b", A: "b", D: "b", G: "b", C: "b" },
  Cb: { B: "b", E: "b", A: "b", D: "b", G: "b", C: "b", F: "b" },
};

export interface ParsedVexKey {
  letter: string;
  octave: string;
  accidental: string | null;
}

/**
 * Extract the accidental symbol from a VexFlow key string.
 * e.g. "c#/4" -> "#", "db/3" -> "b", "e/4" -> null, "f##/5" -> "##", "abb/3" -> "bb"
 */
export function extractAccidental(vexKey: string): string | null {
  const slash = vexKey.indexOf("/");
  const name = slash >= 0 ? vexKey.substring(0, slash) : vexKey;
  const base = name.substring(0, 1);
  const accidental = name.substring(base.length);
  if (accidental === "" || accidental === "n") return null;
  return accidental;
}

export function parseVexKey(vexKey: string): ParsedVexKey | null {
  const [nameRaw, octaveRaw] = vexKey.split("/");
  if (!nameRaw || !octaveRaw) return null;

  const name = nameRaw.toLowerCase();
  const letter = name[0];
  if (!letter || letter < "a" || letter > "g") return null;

  const accidentalPart = name.slice(1);
  return {
    letter: letter.toUpperCase(),
    octave: octaveRaw,
    accidental: accidentalPart === "" ? null : accidentalPart,
  };
}

/**
 * Determine whether an accidental needs to be displayed for a given note
 * in the context of a key signature and the current accidental state within
 * the measure.
 *
 * FIX (R1-05): The `suppressDisplay` check now happens BEFORE mutating
 * accidentalState, preventing state advancement for suppressed tied notes.
 */
export function accidentalToDisplay(
  vexKey: string,
  keySignature: string | undefined,
  accidentalState: Map<string, string>,
  suppressDisplay = false,
): string | null {
  const parsed = parseVexKey(vexKey);
  if (!parsed) return extractAccidental(vexKey);

  const keyDefaults =
    KEY_SIGNATURE_DEFAULTS[keySignature ?? "C"] ?? KEY_SIGNATURE_DEFAULTS.C;
  const defaultAccidental = keyDefaults[parsed.letter] ?? "n";
  const pitchId = `${parsed.letter}${parsed.octave}`;
  const currentAccidental = accidentalState.get(pitchId) ?? defaultAccidental;
  const targetAccidental = parsed.accidental ?? "n";

  if (currentAccidental === targetAccidental) return null;

  // R1-05 FIX: Check suppressDisplay BEFORE mutating state.
  // When a tied continuation note is suppressed, we must not advance
  // the accidental state — the original note already set it.
  if (suppressDisplay) return null;

  accidentalState.set(pitchId, targetAccidental);
  return targetAccidental;
}

/**
 * Check if a VexFlow duration string is dotted.
 * Dotted durations end with "d" (e.g. "qd", "hd", "8d", "wd").
 * Rest durations end with "r" or "dr" (e.g. "qr", "qdr").
 */
export function isDottedDuration(vexDuration: string): boolean {
  const stripped = vexDuration.replace(/r$/, "");
  return stripped.endsWith("d");
}

/**
 * Get the base VexFlow duration without the dotted suffix.
 * "qd" -> "q", "8d" -> "8", "hdr" -> "hr", "wr" -> "wr"
 */
export function baseDuration(vexDuration: string): string {
  const isRest = vexDuration.endsWith("r");
  let core = isRest ? vexDuration.slice(0, -1) : vexDuration;
  if (core.endsWith("d")) {
    core = core.slice(0, -1);
  }
  return isRest ? core + "r" : core;
}

/**
 * Build a VexFlow rest note at the appropriate position for the clef.
 * Uses b/4 for treble, d/3 for bass as conventional rest placement.
 */
export function makeRestKey(clef: "treble" | "bass"): string {
  return clef === "treble" ? "b/4" : "d/3";
}

/** Regex for validating hex color strings (#RGB, #RRGGBB, #RRGGBBAA) */
const HEX_COLOR_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Convert a hex color to rgba string for SVG use.
 *
 * FIX (R1-06): Validates input format and provides a fallback color
 * if the input is not a valid hex string (e.g. an rgb() or named color).
 */
export function hexToRgba(hex: string, alpha: number): string {
  const trimmed = hex.trim();
  if (!HEX_COLOR_RE.test(trimmed)) {
    // Fallback: return a safe semi-transparent black
    return `rgba(0, 0, 0, ${alpha})`;
  }

  let cleaned = trimmed.replace("#", "");

  // Expand shorthand (#RGB -> #RRGGBB)
  if (cleaned.length === 3) {
    cleaned =
      cleaned[0] +
      cleaned[0] +
      cleaned[1] +
      cleaned[1] +
      cleaned[2] +
      cleaned[2];
  }

  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);

  // R2-04 FIX: Parse alpha byte from 8-digit hex (#RRGGBBAA).
  // The embedded alpha (0-255) is multiplied with the caller's alpha parameter.
  let effectiveAlpha = alpha;
  if (cleaned.length === 8) {
    const hexAlpha = parseInt(cleaned.substring(6, 8), 16) / 255;
    effectiveAlpha = alpha * hexAlpha;
  }

  return `rgba(${r}, ${g}, ${b}, ${effectiveAlpha})`;
}
