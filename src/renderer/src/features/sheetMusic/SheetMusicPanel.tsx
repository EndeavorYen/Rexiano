/**
 * SheetMusicPanel — Renders sheet music with VexFlow 5.
 *
 * Rendering model:
 * - Always displays 8 measure slots (configurable via DISPLAY_MEASURE_COUNT).
 * - On the last measure of a group, preload the next measures while
 *   keeping the current one as anchor.
 * - Displays measure numbers on odd measures (1, 3, 5, ...) above treble staff.
 * - Subtly highlights currently active measure + note/chord.
 */

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import type {
  NotationData,
  NotationExpression,
  NotationMeasure,
  DisplayMode,
} from "./types";
import { getCursorPosition, getMeasureWindow } from "./CursorSync";
import {
  buildContinuationKeySet,
  buildTieIndexMapping,
  groupNotesIntoChords,
  isContinuationKey,
  normalizeTickInMeasure,
  type ChordGroup,
} from "./sheetMusicRenderLogic";
import { calcMeasureWidths } from "./sheetMusicUtils";

/** Cached VexFlow module import + fonts.ready to avoid repeated async overhead */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _vexflowCache: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadVexFlow(): Promise<any> {
  if (!_vexflowCache) {
    _vexflowCache = import("vexflow")
      .then(async (VF) => {
        await document.fonts.ready;
        return VF;
      })
      .catch((err) => {
        _vexflowCache = null; // Clear cache so next attempt retries
        throw err;
      });
  }
  return _vexflowCache;
}

/** Layout constants */
const STAVE_HEIGHT = 80;
const SYSTEM_GAP = 20;
const SYSTEM_HEIGHT = STAVE_HEIGHT * 2 + SYSTEM_GAP;
const LEFT_MARGIN = 28;
const TOP_MARGIN = 10;
const DISPLAY_MEASURE_COUNT = 8;
const FIRST_MEASURE_MIN_WIDTH = 220;
const ACTIVE_NOTEHEAD_STROKE_WIDTH_PX = 2.2;
const ACTIVE_NOTEHEAD_GLOW_BLUR_PX = 4.2;
const ACTIVE_BEAT_SNAP_RATIO = 0.62;
const ACTIVE_BEAT_MATCH_TICK_EPSILON = 1;

/**
 * Extract the accidental symbol from a VexFlow key string.
 * e.g. "c#/4" → "#", "db/3" → "b", "e/4" → null, "f##/5" → "##", "abb/3" → "bb"
 */
function extractAccidental(vexKey: string): string | null {
  const slash = vexKey.indexOf("/");
  const name = slash >= 0 ? vexKey.substring(0, slash) : vexKey;
  // Strip the base letter (a-g), whatever remains is the accidental
  const base = name.substring(0, 1);
  const accidental = name.substring(base.length);
  if (accidental === "" || accidental === "n") return null;
  return accidental; // "#", "b", "##", "bb"
}

interface ParsedVexKey {
  letter: string;
  octave: string;
  accidental: string | null;
}

/** Key-signature defaults by note letter. */
const KEY_SIGNATURE_DEFAULTS: Record<string, Record<string, string>> = {
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

function parseVexKey(vexKey: string): ParsedVexKey | null {
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

function accidentalToDisplay(
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
  accidentalState.set(pitchId, targetAccidental);
  return suppressDisplay ? null : targetAccidental;
}

/**
 * Check if a VexFlow duration string is dotted.
 * Dotted durations end with "d" (e.g. "qd", "hd", "8d", "wd").
 * Rest durations end with "r" or "dr" (e.g. "qr", "qdr").
 */
function isDottedDuration(vexDuration: string): boolean {
  const stripped = vexDuration.replace(/r$/, "");
  return stripped.endsWith("d");
}

/**
 * Get the base VexFlow duration without the dotted suffix.
 * "qd" → "q", "8d" → "8", "hdr" → "hr", "wr" → "wr"
 */
function baseDuration(vexDuration: string): string {
  const isRest = vexDuration.endsWith("r");
  let core = isRest ? vexDuration.slice(0, -1) : vexDuration;
  if (core.endsWith("d")) {
    core = core.slice(0, -1);
  }
  return isRest ? core + "r" : core;
}

/** Available zoom levels for sheet music display */
const ZOOM_LEVELS = [0.75, 1.0, 1.25, 1.5] as const;

interface SheetMusicPanelProps {
  notationData: NotationData | null;
  mode: DisplayMode;
  height?: number;
}

/** Convert a hex color to rgba string for SVG use. */
function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Build a VexFlow rest note at the appropriate position for the clef.
 * Uses b/4 for treble, d/3 for bass as conventional rest placement.
 */
function makeRestKey(clef: "treble" | "bass"): string {
  return clef === "treble" ? "b/4" : "d/3";
}

/** Return value from renderMeasure for post-render passes (ties, beams). */
interface MeasureRenderResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trebleVexNotes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bassVexNotes: any[];
  trebleChords: ChordGroup[];
  bassChords: ChordGroup[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trebleStave: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bassStave: any;
  tickAnchors: TickAnchor[];
}

interface TickAnchor {
  tick: number;
  x: number;
}

interface NoteHeadHighlight {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

function pickActiveBeatChordIndexes(
  chords: ChordGroup[],
  ticksPerBeat: number,
  isActiveMeasure: boolean,
  activeBeatTick: number | null,
): Set<number> {
  const active = new Set<number>();
  if (!isActiveMeasure || activeBeatTick === null) return active;
  if (!Number.isFinite(ticksPerBeat) || ticksPerBeat <= 0) return active;

  let minDistance = Number.POSITIVE_INFINITY;
  const candidateIndexes: number[] = [];
  for (let i = 0; i < chords.length; i++) {
    const chord = chords[i];
    if (!chord || chord.duration.includes("r")) continue;
    if (!Number.isFinite(chord.startTick)) continue;

    const distance = Math.abs(chord.startTick - activeBeatTick);
    if (distance + ACTIVE_BEAT_MATCH_TICK_EPSILON < minDistance) {
      minDistance = distance;
      candidateIndexes.length = 0;
      candidateIndexes.push(i);
      continue;
    }
    if (Math.abs(distance - minDistance) <= ACTIVE_BEAT_MATCH_TICK_EPSILON) {
      candidateIndexes.push(i);
    }
  }

  const maxSnapDistance = ticksPerBeat * ACTIVE_BEAT_SNAP_RATIO;
  if (candidateIndexes.length === 0 || minDistance > maxSnapDistance) {
    return active;
  }

  for (const idx of candidateIndexes) active.add(idx);
  return active;
}

function collectNoteHeadHighlights(
  chords: ChordGroup[],
  vexNotes: unknown[],
  ticksPerBeat: number,
  isActiveMeasure: boolean,
  activeBeatTick: number | null,
): NoteHeadHighlight[] {
  const highlights: NoteHeadHighlight[] = [];
  const activeChordIndexes = pickActiveBeatChordIndexes(
    chords,
    ticksPerBeat,
    isActiveMeasure,
    activeBeatTick,
  );
  if (activeChordIndexes.size === 0) return highlights;

  for (let i = 0; i < chords.length; i++) {
    if (!activeChordIndexes.has(i)) continue;

    const vexNote = vexNotes[i] as
      | {
          getAbsoluteX?: unknown;
          getGlyphWidth?: unknown;
          getYs?: unknown;
        }
      | undefined;
    const getAbsoluteX = vexNote?.getAbsoluteX;
    const getGlyphWidth = vexNote?.getGlyphWidth;
    const getYs = vexNote?.getYs;
    if (
      typeof getAbsoluteX !== "function" ||
      typeof getGlyphWidth !== "function" ||
      typeof getYs !== "function"
    ) {
      continue;
    }

    const headX = Number(getAbsoluteX.call(vexNote));
    const glyphWidth = Number(getGlyphWidth.call(vexNote));
    const ys = getYs.call(vexNote) as unknown;
    if (!Number.isFinite(headX) || !Number.isFinite(glyphWidth)) continue;
    if (!Array.isArray(ys) || ys.length === 0) continue;

    const width = Math.max(7, glyphWidth);
    const centerX = headX + width * 0.52;
    for (const yRaw of ys) {
      const headY = Number(yRaw);
      if (!Number.isFinite(headY)) continue;
      highlights.push({
        cx: centerX,
        cy: headY,
        rx: Math.max(4.6, width * 0.54),
        ry: Math.max(3.4, width * 0.4),
      });
    }
  }

  return highlights;
}

function drawNoteHeadHighlights(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  highlights: NoteHeadHighlight[],
  accentHex: string,
): void {
  if (highlights.length === 0) return;
  const svg = context.svg as SVGSVGElement | undefined;
  if (!svg) return;

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("pointer-events", "none");
  group.setAttribute("data-rx-notehead-highlight-layer", "1");

  for (const head of highlights) {
    const ring = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "ellipse",
    );
    ring.setAttribute("cx", String(head.cx));
    ring.setAttribute("cy", String(head.cy));
    ring.setAttribute("rx", String(head.rx));
    ring.setAttribute("ry", String(head.ry));
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", accentHex);
    ring.setAttribute("stroke-width", String(ACTIVE_NOTEHEAD_STROKE_WIDTH_PX));
    ring.setAttribute("opacity", "0.96");
    ring.setAttribute(
      "style",
      `filter: drop-shadow(0 0 ${ACTIVE_NOTEHEAD_GLOW_BLUR_PX}px ${accentHex});`,
    );
    group.appendChild(ring);
  }

  svg.appendChild(group);
}

function buildTickAnchorsFromRenderedNotes(
  totalTicks: number,
  noteStartX: number,
  noteEndX: number,
  trebleChords: ChordGroup[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trebleVexNotes: any[],
  bassChords: ChordGroup[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bassVexNotes: any[],
): TickAnchor[] {
  const boundedTotalTicks = Math.max(1, Math.round(totalTicks));
  const xSamplesByTick = new Map<number, number[]>();
  const pushSample = (tick: number, x: number): void => {
    if (!Number.isFinite(tick) || !Number.isFinite(x)) return;
    const normalizedTick = Math.max(
      0,
      Math.min(boundedTotalTicks, Math.round(tick)),
    );
    const arr = xSamplesByTick.get(normalizedTick);
    if (arr) arr.push(x);
    else xSamplesByTick.set(normalizedTick, [x]);
  };
  const collect = (
    chords: ChordGroup[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vexNotes: any[],
  ): void => {
    for (let i = 0; i < chords.length; i++) {
      const chord = chords[i];
      const vexNote = vexNotes[i];
      if (!chord || !vexNote || typeof vexNote.getAbsoluteX !== "function")
        continue;
      const x = vexNote.getAbsoluteX();
      if (!Number.isFinite(x)) continue;
      pushSample(chord.startTick, x);
    }
  };

  pushSample(0, noteStartX);
  pushSample(boundedTotalTicks, noteEndX);
  collect(trebleChords, trebleVexNotes);
  collect(bassChords, bassVexNotes);

  const ticks = Array.from(xSamplesByTick.keys()).sort((a, b) => a - b);
  if (ticks.length === 0) {
    return [
      { tick: 0, x: noteStartX },
      { tick: boundedTotalTicks, x: noteEndX },
    ];
  }

  const minX = Math.min(noteStartX, noteEndX);
  const maxX = Math.max(noteStartX, noteEndX);
  const anchors = ticks.map((tick) => {
    const samples = xSamplesByTick.get(tick) ?? [noteStartX];
    const avgX =
      samples.reduce((sum, value) => sum + value, 0) / samples.length;
    return {
      tick,
      x: Math.max(minX, Math.min(maxX, avgX)),
    };
  });

  let lastX = anchors[0]?.x ?? noteStartX;
  return anchors.map((anchor, index) => {
    if (index === 0) return anchor;
    const nextX = Math.max(lastX, anchor.x);
    lastX = nextX;
    return { tick: anchor.tick, x: nextX };
  });
}

function interpolateTickAnchorX(tick: number, anchors: TickAnchor[]): number {
  if (anchors.length === 0) return 0;
  if (anchors.length === 1) return anchors[0].x;
  if (tick <= anchors[0].tick) return anchors[0].x;

  for (let i = 1; i < anchors.length; i++) {
    const left = anchors[i - 1];
    const right = anchors[i];
    if (tick <= right.tick) {
      const span = right.tick - left.tick;
      if (span <= 0) return right.x;
      const ratio = (tick - left.tick) / span;
      return left.x + (right.x - left.x) * ratio;
    }
  }

  return anchors[anchors.length - 1].x;
}

/**
 * Create a VexFlow StaveNote with proper accidentals and dots.
 */
function createVexNote(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VF: any,
  chord: ChordGroup,
  clef: "treble" | "bass" = "treble",
  keySignature: string | undefined,
  accidentalState: Map<string, string>,
  continuationKeys?: Set<string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { StaveNote, Accidental, Dot } = VF;
  const dotted = isDottedDuration(chord.duration);
  const duration = dotted ? baseDuration(chord.duration) : chord.duration;

  const noteOpts: Record<string, unknown> = {
    keys: chord.keys,
    duration,
  };
  if (clef === "bass") noteOpts.clef = "bass";

  const note = new StaveNote(noteOpts);

  // Add accidentals for each key in the chord
  if (Accidental) {
    for (let i = 0; i < chord.keys.length; i++) {
      const suppressForTiedContinuation =
        chord.startTick === 0 &&
        isContinuationKey(chord.keys[i], continuationKeys);
      const acc = accidentalToDisplay(
        chord.keys[i],
        keySignature,
        accidentalState,
        suppressForTiedContinuation,
      );
      if (acc) {
        note.addModifier(new Accidental(acc), i);
      }
    }
  }

  // Add augmentation dots for dotted durations
  if (dotted && Dot) {
    Dot.buildAndAttach([note], { all: true });
  }

  return note;
}

function renderMeasure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VF: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  measure: NotationMeasure,
  x: number,
  y: number,
  width: number,
  isFirst: boolean,
  ticksPerQuarter: number,
  trebleContinuationKeys: Set<string>,
  bassContinuationKeys: Set<string>,
  accentHex: string,
  isActiveMeasure: boolean,
  activeBeatTick: number | null,
  measureNumber?: number,
  expressions?: NotationExpression[],
  prevMeasure?: NotationMeasure,
): MeasureRenderResult {
  const { Stave, StaveNote, Voice, Formatter, StaveConnector, Articulation } =
    VF;

  // Detect key/time signature changes from previous measure
  const keySigChanged =
    !isFirst &&
    prevMeasure &&
    prevMeasure.keySignature !== measure.keySignature;
  const timeSigChanged =
    !isFirst &&
    prevMeasure &&
    (prevMeasure.timeSignatureTop !== measure.timeSignatureTop ||
      prevMeasure.timeSignatureBottom !== measure.timeSignatureBottom);

  // Show key signature if: non-C key, OR key changed from previous measure (including back to C)
  const showKeySig =
    (measure.keySignature && measure.keySignature !== "C") || keySigChanged;

  const treble = new Stave(x, y, width);
  if (isFirst) {
    treble.addClef("treble");
    if (showKeySig) {
      treble.addKeySignature(measure.keySignature);
    }
    treble.addTimeSignature(
      `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`,
    );
  } else {
    if (keySigChanged) {
      treble.addKeySignature(measure.keySignature);
    }
    if (timeSigChanged) {
      treble.addTimeSignature(
        `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`,
      );
    }
  }
  treble.setContext(context).draw();

  const bass = new Stave(x, y + STAVE_HEIGHT + SYSTEM_GAP, width);
  if (isFirst) {
    bass.addClef("bass");
    if (showKeySig) {
      bass.addKeySignature(measure.keySignature);
    }
    bass.addTimeSignature(
      `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`,
    );
  } else {
    if (keySigChanged) {
      bass.addKeySignature(measure.keySignature);
    }
    if (timeSigChanged) {
      bass.addTimeSignature(
        `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`,
      );
    }
  }
  bass.setContext(context).draw();

  if (isFirst) {
    new StaveConnector(treble, bass)
      .setType("brace")
      .setContext(context)
      .draw();
  }
  new StaveConnector(treble, bass)
    .setType("singleRight")
    .setContext(context)
    .draw();

  // Draw measure number above treble staff on odd measures (1, 3, 5, ...)
  if (measureNumber !== undefined) {
    const svg = context.svg as SVGSVGElement | undefined;
    if (svg) {
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      text.setAttribute("x", String(x + 4));
      text.setAttribute("y", String(y - 2));
      text.setAttribute("font-size", "10");
      text.setAttribute("font-family", "'DM Sans', 'Nunito', sans-serif");
      text.setAttribute("fill", "var(--color-text-muted, #888)");
      text.setAttribute("opacity", "0.7");
      text.textContent = String(measureNumber);
      svg.appendChild(text);
    }
  }

  // Build a set of staccato tick positions from expression marks
  const staccatoTicks = new Set<number>();
  const ticksPerBeat =
    ticksPerQuarter * (4 / Math.max(1, measure.timeSignatureBottom));
  const ticksPerMeasure = Math.max(
    1,
    Math.round(ticksPerBeat * Math.max(1, measure.timeSignatureTop)),
  );
  if (expressions) {
    const beatsPerMeasure = measure.timeSignatureTop;
    for (const expr of expressions) {
      if (expr.type === "staccato") {
        const targetFraction = expr.beat / beatsPerMeasure;
        staccatoTicks.add(Math.round(targetFraction * 1000));
      }
    }
  }

  const trebleChords = groupNotesIntoChords(measure.trebleNotes);
  const trebleAccidentalState = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trebleVexNotes: any[] =
    trebleChords.length > 0
      ? trebleChords.map((chord) => {
          const note = createVexNote(
            VF,
            chord,
            "treble",
            measure.keySignature,
            trebleAccidentalState,
            trebleContinuationKeys,
          );
          if (expressions && Articulation) {
            const normalizedTick = normalizeTickInMeasure(
              chord.startTick,
              ticksPerQuarter,
              measure.timeSignatureTop,
              measure.timeSignatureBottom,
            );
            if (staccatoTicks.has(normalizedTick)) {
              try {
                note.addModifier(new Articulation("a."), 0);
              } catch {
                // Articulation not available in this VexFlow build
              }
            }
          }
          return note;
        })
      : [
          (() => {
            const rest = new StaveNote({
              keys: [makeRestKey("treble")],
              duration: "wr",
            });
            return rest;
          })(),
        ];

  const bassChords = groupNotesIntoChords(measure.bassNotes);
  const bassAccidentalState = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bassVexNotes: any[] =
    bassChords.length > 0
      ? bassChords.map((chord) => {
          const note = createVexNote(
            VF,
            chord,
            "bass",
            measure.keySignature,
            bassAccidentalState,
            bassContinuationKeys,
          );
          if (expressions && Articulation) {
            const normalizedTick = normalizeTickInMeasure(
              chord.startTick,
              ticksPerQuarter,
              measure.timeSignatureTop,
              measure.timeSignatureBottom,
            );
            if (staccatoTicks.has(normalizedTick)) {
              try {
                note.addModifier(new Articulation("a."), 0);
              } catch {
                // Articulation not available
              }
            }
          }
          return note;
        })
      : [
          (() => {
            const rest = new StaveNote({
              keys: [makeRestKey("bass")],
              duration: "wr",
              clef: "bass",
            });
            return rest;
          })(),
        ];

  const trebleVoice = new Voice({
    num_beats: measure.timeSignatureTop,
    beat_value: measure.timeSignatureBottom,
  }).setStrict(false);
  trebleVoice.addTickables(trebleVexNotes);

  const bassVoice = new Voice({
    num_beats: measure.timeSignatureTop,
    beat_value: measure.timeSignatureBottom,
  }).setStrict(false);
  bassVoice.addTickables(bassVexNotes);

  const formatter = new Formatter()
    .joinVoices([trebleVoice])
    .joinVoices([bassVoice]);
  // Use VexFlow's stave-aware formatter to avoid collisions with clef/time/key modifiers.
  const sharedStartX = Math.max(treble.getNoteStartX(), bass.getNoteStartX());
  treble.setNoteStartX(sharedStartX);
  bass.setNoteStartX(sharedStartX);
  formatter.formatToStave([trebleVoice, bassVoice], treble);

  trebleVoice.draw(context, treble);
  bassVoice.draw(context, bass);

  // Draw beams for treble and bass notes.
  // Beam.generateBeams automatically groups 8th/16th/32nd notes into beamed
  // groups and ignores quarter notes and longer. We pass only non-rest notes
  // since rests break beam groups.
  try {
    const { Beam } = VF;
    if (Beam) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const drawBeams = (vexNotes: any[], chords: ChordGroup[]): void => {
        const nonRestNotes = vexNotes.filter(
          (_n: unknown, i: number) =>
            chords[i] && !chords[i].duration.includes("r"),
        );
        if (nonRestNotes.length > 1) {
          const beams = Beam.generateBeams(nonRestNotes);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          beams.forEach((b: any) => b.setContext(context).draw());
        }
      };
      drawBeams(trebleVexNotes, trebleChords);
      drawBeams(bassVexNotes, bassChords);
    }
  } catch {
    // Beam generation can fail for certain note configurations; silently skip
  }

  const highlightedNoteHeads = [
    ...collectNoteHeadHighlights(
      trebleChords,
      trebleVexNotes,
      ticksPerBeat,
      isActiveMeasure,
      activeBeatTick,
    ),
    ...collectNoteHeadHighlights(
      bassChords,
      bassVexNotes,
      ticksPerBeat,
      isActiveMeasure,
      activeBeatTick,
    ),
  ];
  drawNoteHeadHighlights(context, highlightedNoteHeads, accentHex);

  // Render text-based expression marks (rit., accel., legato) above the treble staff
  if (expressions && expressions.length > 0) {
    const svg = context.svg as SVGSVGElement | undefined;
    if (svg) {
      const beatsPerMeasure = measure.timeSignatureTop;
      for (const expr of expressions) {
        if (expr.type === "staccato") continue;

        const label =
          expr.type === "rit"
            ? "rit."
            : expr.type === "accel"
              ? "accel."
              : "legato";
        const isItalic =
          expr.type === "rit" ||
          expr.type === "accel" ||
          expr.type === "legato";
        const beatFraction = Math.max(
          0,
          Math.min(1, expr.beat / beatsPerMeasure),
        );
        const textX = x + width * beatFraction + (isFirst ? 40 : 10);
        const textY = y - 6;

        const text = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        text.setAttribute("x", String(textX));
        text.setAttribute("y", String(textY));
        text.setAttribute("font-size", "11");
        text.setAttribute("font-family", "'DM Sans', 'Nunito', sans-serif");
        text.setAttribute("font-style", isItalic ? "italic" : "normal");
        text.setAttribute("font-weight", "500");
        text.setAttribute("fill", "var(--color-accent, #1E6E72)");
        text.setAttribute("opacity", "0.85");
        text.textContent = label;
        svg.appendChild(text);
      }
    }
  }

  return {
    trebleVexNotes,
    bassVexNotes,
    trebleChords,
    bassChords,
    trebleStave: treble,
    bassStave: bass,
    tickAnchors: buildTickAnchorsFromRenderedNotes(
      ticksPerMeasure,
      sharedStartX,
      Math.max(treble.getNoteEndX(), bass.getNoteEndX()),
      trebleChords,
      trebleVexNotes,
      bassChords,
      bassVexNotes,
    ),
  };
}

/**
 * Draw an empty slot when the song has fewer measures than display slots.
 */
function renderEmptyMeasure(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VF: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  x: number,
  y: number,
  width: number,
  isFirst: boolean,
  timeSignature = "4/4",
): void {
  const { Stave, StaveConnector } = VF;
  const treble = new Stave(x, y, width);
  if (isFirst) {
    treble.addClef("treble").addTimeSignature(timeSignature);
  }
  treble.setContext(context).draw();

  const bass = new Stave(x, y + STAVE_HEIGHT + SYSTEM_GAP, width);
  if (isFirst) {
    bass.addClef("bass").addTimeSignature(timeSignature);
  }
  bass.setContext(context).draw();

  if (isFirst) {
    new StaveConnector(treble, bass)
      .setType("brace")
      .setContext(context)
      .draw();
  }
  new StaveConnector(treble, bass)
    .setType("singleRight")
    .setContext(context)
    .draw();
}

export function SheetMusicPanel({
  notationData,
  mode,
  height = 220,
}: SheetMusicPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const themeId = useThemeStore((s) => s.themeId);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [vexflowError, setVexflowError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent): void =>
      setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  const cursorTransition = prefersReducedMotion ? "none" : "left 120ms linear";
  const measureTransition = prefersReducedMotion
    ? "none"
    : "left 120ms ease-out, width 120ms ease-out";
  const [measureTickAnchors, setMeasureTickAnchors] = useState<
    Record<number, TickAnchor[]>
  >({});
  const hidden = mode !== "sheet" && mode !== "split";

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => {
      const idx = ZOOM_LEVELS.indexOf(prev as (typeof ZOOM_LEVELS)[number]);
      return idx < ZOOM_LEVELS.length - 1 ? ZOOM_LEVELS[idx + 1] : prev;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => {
      const idx = ZOOM_LEVELS.indexOf(prev as (typeof ZOOM_LEVELS)[number]);
      return idx > 0 ? ZOOM_LEVELS[idx - 1] : prev;
    });
  }, []);

  /** Read the computed accent color from CSS custom properties for VexFlow SVG rendering. */
  const accentHex = useMemo(() => {
    if (typeof document === "undefined") return "#1E6E72";
    const style = getComputedStyle(document.documentElement);
    return style.getPropertyValue("--color-accent").trim() || "#1E6E72";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId]);

  const cursorPosition = useMemo(() => {
    if (!notationData) return null;
    return getCursorPosition(currentTime, notationData);
  }, [currentTime, notationData]);
  const activeMeasureIndex = cursorPosition?.measureIndex ?? 0;

  const visibleMeasures = useMemo(() => {
    if (!notationData || notationData.measures.length === 0) return [];
    return getMeasureWindow(activeMeasureIndex, notationData.measures.length);
  }, [notationData, activeMeasureIndex]);

  const availableWidth = Math.max(
    1,
    Math.floor(containerWidth - LEFT_MARGIN * 2),
  );
  const rawSlotWidths = useMemo(() => {
    const noteCounts = Array.from(
      { length: DISPLAY_MEASURE_COUNT },
      (_unused, slot) => {
        const measureIndex = visibleMeasures[slot];
        if (measureIndex === undefined || !notationData) return 0;
        const measure = notationData.measures[measureIndex];
        if (!measure) return 0;
        const treble = measure.trebleNotes.filter((n) => !n.isRest).length;
        const bass = measure.bassNotes.filter((n) => !n.isRest).length;
        return treble + bass;
      },
    );
    return calcMeasureWidths(noteCounts, availableWidth);
  }, [availableWidth, notationData, visibleMeasures]);
  const slotWidths = useMemo(() => {
    if (rawSlotWidths.length === 0) return rawSlotWidths;
    const next = [...rawSlotWidths];
    next[0] = Math.max(next[0], FIRST_MEASURE_MIN_WIDTH);
    return next;
  }, [rawSlotWidths]);
  const slotLefts = useMemo(() => {
    const lefts: number[] = [];
    let cursor = LEFT_MARGIN;
    for (let i = 0; i < DISPLAY_MEASURE_COUNT; i++) {
      lefts.push(cursor);
      cursor += slotWidths[i] ?? 0;
    }
    return lefts;
  }, [slotWidths]);
  const contentWidth =
    LEFT_MARGIN * 2 + slotWidths.reduce((sum, width) => sum + width, 0);
  const totalHeight = SYSTEM_HEIGHT + TOP_MARGIN * 2 + 16;
  const activeSlotIndex =
    cursorPosition && visibleMeasures.length > 0
      ? visibleMeasures.indexOf(cursorPosition.measureIndex)
      : -1;
  const activeMeasure =
    activeSlotIndex >= 0 && cursorPosition && notationData
      ? notationData.measures[cursorPosition.measureIndex]
      : null;
  const activeMeasureWidth =
    activeSlotIndex >= 0 ? (slotWidths[activeSlotIndex] ?? 0) : 0;
  const activeMeasureLeft =
    activeSlotIndex >= 0 ? (slotLefts[activeSlotIndex] ?? LEFT_MARGIN) : 0;
  const activeTickAnchors =
    cursorPosition && activeSlotIndex >= 0
      ? measureTickAnchors[cursorPosition.measureIndex]
      : undefined;
  const cursorLeft = useMemo(() => {
    if (!cursorPosition || activeSlotIndex < 0) return activeMeasureLeft;
    if (activeTickAnchors && activeTickAnchors.length >= 2) {
      return interpolateTickAnchorX(cursorPosition.tick, activeTickAnchors);
    }

    // Fallback when anchors are unavailable: beat-ratio placement.
    const beatsPerMeasure = Math.max(activeMeasure?.timeSignatureTop ?? 4, 1);
    const beatRatio = Math.max(
      0,
      Math.min(0.995, cursorPosition.beat / beatsPerMeasure),
    );
    return activeMeasureLeft + activeMeasureWidth * beatRatio;
  }, [
    activeMeasure?.timeSignatureTop,
    activeMeasureLeft,
    activeMeasureWidth,
    activeSlotIndex,
    activeTickAnchors,
    cursorPosition,
  ]);
  const activeBeatState = useMemo(() => {
    if (!cursorPosition || !notationData) return null;
    const measure = notationData.measures[cursorPosition.measureIndex];
    if (!measure) return null;

    const ticksPerBeat =
      notationData.ticksPerQuarter *
      (4 / Math.max(1, measure.timeSignatureBottom));
    if (!Number.isFinite(ticksPerBeat) || ticksPerBeat <= 0) return null;
    const beatIndex = Math.max(
      0,
      Math.floor(cursorPosition.tick / ticksPerBeat),
    );
    return {
      measureIndex: cursorPosition.measureIndex,
      beatTick: Math.round(beatIndex * ticksPerBeat),
    };
  }, [cursorPosition, notationData]);
  const activeBeatMeasureIndex = activeBeatState?.measureIndex ?? -1;
  const activeBeatTick = activeBeatState?.beatTick ?? null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keyboard shortcuts: Ctrl+= to zoom in, Ctrl+- to zoom out
  useEffect(() => {
    const el = containerRef.current;
    if (!el || hidden) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      }
    };
    el.addEventListener("keydown", handleKey);
    return () => el.removeEventListener("keydown", handleKey);
  }, [hidden, zoomIn, zoomOut]);

  /*
   * VexFlow rendering effect — triggers on measure window or layout changes.
   *
   * Performance note: this re-renders the SVG only when `visibleMeasures`
   * changes (i.e. the active measure crosses a window boundary), NOT on
   * every animation frame. The `visibleMeasures` array is memoised above
   * and only produces a new reference when `activeMeasureIndex` moves to a
   * different measure, so the cost is bounded by the number of measure
   * transitions — typically a few times per minute at normal playback speed.
   */
  useEffect(() => {
    const host = svgHostRef.current;
    if (
      hidden ||
      !host ||
      !notationData ||
      notationData.measures.length === 0 ||
      slotWidths.length === 0
    ) {
      return;
    }

    let cancelled = false;
    void loadVexFlow()
      .then((VF) => {
        if (cancelled || !svgHostRef.current) return;

        const { Renderer, StaveTie } = VF;
        const stage = document.createElement("div");
        const renderer = new Renderer(stage, Renderer.Backends.SVG);
        renderer.resize(
          Math.max(containerWidth, contentWidth),
          Math.max(totalHeight, height),
        );
        const context = renderer.getContext();

        // Collect render results for cross-measure tie rendering
        const slotResults: (MeasureRenderResult | null)[] = [];
        const slotMeasureIndices: (number | undefined)[] = [];
        const nextMeasureTickAnchors: Record<number, TickAnchor[]> = {};

        for (let slot = 0; slot < DISPLAY_MEASURE_COUNT; slot++) {
          const measureIndex = visibleMeasures[slot];
          const x = slotLefts[slot] ?? LEFT_MARGIN;
          const width = slotWidths[slot] ?? 1;
          const y = TOP_MARGIN;
          const isFirst = slot === 0;

          slotMeasureIndices.push(measureIndex);

          if (measureIndex === undefined) {
            const lastMeasure =
              notationData.measures[notationData.measures.length - 1];
            const timeSig = lastMeasure
              ? `${lastMeasure.timeSignatureTop}/${lastMeasure.timeSignatureBottom}`
              : "4/4";
            renderEmptyMeasure(VF, context, x, y, width, isFirst, timeSig);
            slotResults.push(null);
            continue;
          }

          const measure = notationData.measures[measureIndex];
          const previousMeasure =
            measureIndex > 0
              ? notationData.measures[measureIndex - 1]
              : undefined;
          const measureExpressions = notationData.expressions?.filter(
            (e) => e.measureIndex === measureIndex,
          );
          const trebleContinuationKeys = buildContinuationKeySet(
            measure.trebleNotes,
            previousMeasure?.trebleNotes,
          );
          const bassContinuationKeys = buildContinuationKeySet(
            measure.bassNotes,
            previousMeasure?.bassNotes,
          );

          try {
            const result = renderMeasure(
              VF,
              context,
              measure,
              x,
              y,
              width,
              isFirst,
              notationData.ticksPerQuarter,
              trebleContinuationKeys,
              bassContinuationKeys,
              accentHex,
              measureIndex === activeBeatMeasureIndex,
              activeBeatTick,
              measureIndex + 1,
              measureExpressions,
              previousMeasure,
            );
            slotResults.push(result);
            nextMeasureTickAnchors[measureIndex] = result.tickAnchors;
          } catch (e) {
            console.warn(
              `SheetMusic: failed to render measure ${measureIndex}:`,
              e,
            );
            slotResults.push(null);
          }
        }

        // Draw ties between consecutive measures for notes marked as tied
        if (StaveTie) {
          for (let slot = 0; slot < DISPLAY_MEASURE_COUNT - 1; slot++) {
            const currentResult = slotResults[slot];
            const nextResult = slotResults[slot + 1];
            const currentMeasureIdx = slotMeasureIndices[slot];
            const nextMeasureIdx = slotMeasureIndices[slot + 1];
            if (
              !currentResult ||
              !nextResult ||
              currentMeasureIdx === undefined ||
              nextMeasureIdx === undefined
            )
              continue;

            // Only draw ties for consecutive measure indices
            if (nextMeasureIdx !== currentMeasureIdx + 1) continue;

            // Check treble notes for ties
            for (let ni = 0; ni < currentResult.trebleChords.length; ni++) {
              if (nextResult.trebleVexNotes.length === 0) continue;
              const tieMapping = buildTieIndexMapping(
                currentResult.trebleChords[ni],
                nextResult.trebleChords,
              );
              if (!tieMapping) continue;

              try {
                new StaveTie({
                  firstNote: currentResult.trebleVexNotes[ni],
                  lastNote:
                    nextResult.trebleVexNotes[tieMapping.targetChordIndex],
                  firstIndexes: tieMapping.firstIndexes,
                  lastIndexes: tieMapping.lastIndexes,
                })
                  .setContext(context)
                  .draw();
              } catch {
                // Tie rendering can fail for edge cases; skip silently
              }
            }

            // Check bass notes for ties
            for (let ni = 0; ni < currentResult.bassChords.length; ni++) {
              if (nextResult.bassVexNotes.length === 0) continue;
              const tieMapping = buildTieIndexMapping(
                currentResult.bassChords[ni],
                nextResult.bassChords,
              );
              if (!tieMapping) continue;

              try {
                new StaveTie({
                  firstNote: currentResult.bassVexNotes[ni],
                  lastNote:
                    nextResult.bassVexNotes[tieMapping.targetChordIndex],
                  firstIndexes: tieMapping.firstIndexes,
                  lastIndexes: tieMapping.lastIndexes,
                })
                  .setContext(context)
                  .draw();
              } catch {
                // Tie rendering can fail; skip silently
              }
            }
          }
        }

        if (cancelled || !svgHostRef.current) return;
        const nextSvg = stage.querySelector("svg");
        if (nextSvg) {
          host.replaceChildren(nextSvg);
        } else {
          host.replaceChildren();
        }
        setMeasureTickAnchors(nextMeasureTickAnchors);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("SheetMusic: failed to load VexFlow", err);
          setVexflowError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    hidden,
    notationData,
    containerWidth,
    contentWidth,
    height,
    slotLefts,
    slotWidths,
    totalHeight,
    visibleMeasures,
    accentHex,
    activeBeatMeasureIndex,
    activeBeatTick,
  ]);

  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative w-full overflow-auto outline-none"
      style={{
        flex: mode === "sheet" ? 1 : undefined,
        height: mode === "split" ? "100%" : height,
        minHeight: mode === "split" ? undefined : height,
        background:
          "color-mix(in srgb, var(--color-surface) 88%, var(--color-bg))",
      }}
      data-testid="sheet-music-panel"
    >
      {/* Scaled container: SVG + overlays share the same transform so they stay aligned */}
      <div
        style={{
          position: "relative",
          minWidth: Math.max(containerWidth, contentWidth),
          transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
          transformOrigin: "top left",
        }}
      >
        <div
          ref={svgHostRef}
          className="h-full"
          style={{ minWidth: Math.max(containerWidth, contentWidth) }}
          data-testid="sheet-music-svg-host"
        />

        {activeSlotIndex >= 0 && cursorPosition && (
          <>
            <div
              className="absolute pointer-events-none"
              style={{
                left: activeMeasureLeft,
                width: activeMeasureWidth,
                top: TOP_MARGIN,
                height: SYSTEM_HEIGHT,
                background: hexToRgba(accentHex, 0.06),
                borderRadius: 3,
                transition: measureTransition,
              }}
              data-testid="sheet-active-measure-overlay"
            />
            <div
              className="absolute pointer-events-none"
              style={{
                left: cursorLeft,
                width: 2,
                top: TOP_MARGIN + 4,
                height: SYSTEM_HEIGHT - 8,
                background: `linear-gradient(180deg, ${hexToRgba(accentHex, 0.75)}, ${hexToRgba(accentHex, 0.4)})`,
                borderRadius: 999,
                boxShadow: `0 0 8px ${hexToRgba(accentHex, 0.3)}`,
                transform: "translateX(-1px)",
                transition: cursorTransition,
              }}
              data-testid="sheet-cursor-line"
            />
            <div
              className="absolute pointer-events-none"
              style={{
                left: cursorLeft - 4,
                top: TOP_MARGIN + 32,
                width: 8,
                height: 8,
                borderRadius: "999px",
                background: hexToRgba(accentHex, 0.92),
                boxShadow: `0 0 10px ${hexToRgba(accentHex, 0.35)}`,
                transition: cursorTransition,
              }}
              data-testid="sheet-cursor-dot"
            />
          </>
        )}
      </div>

      {/* Zoom controls */}
      <div
        className="absolute top-1 right-2 flex items-center gap-0.5 z-10"
        style={{ opacity: 0.75 }}
      >
        <button
          type="button"
          className="px-2 py-1 rounded text-xs font-mono"
          style={{
            background: "var(--color-surface-alt)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            cursor: zoomLevel > ZOOM_LEVELS[0] ? "pointer" : "not-allowed",
            opacity: zoomLevel > ZOOM_LEVELS[0] ? 1 : 0.4,
          }}
          onClick={zoomOut}
          disabled={zoomLevel <= ZOOM_LEVELS[0]}
          aria-label={t("sheetMusic.zoomOut")}
          title={t("sheetMusic.zoomOut")}
        >
          −
        </button>
        <span
          className="text-xs font-mono min-w-[3ch] text-center select-none"
          style={{ color: "var(--color-text-muted)" }}
        >
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          type="button"
          className="px-2 py-1 rounded text-xs font-mono"
          style={{
            background: "var(--color-surface-alt)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            cursor:
              zoomLevel < ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
                ? "pointer"
                : "not-allowed",
            opacity: zoomLevel < ZOOM_LEVELS[ZOOM_LEVELS.length - 1] ? 1 : 0.4,
          }}
          onClick={zoomIn}
          disabled={zoomLevel >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          aria-label={t("sheetMusic.zoomIn")}
          title={t("sheetMusic.zoomIn")}
        >
          +
        </button>
      </div>

      {!notationData && !vexflowError && (
        <div
          className="absolute inset-0 flex items-center justify-center h-full text-sm font-body"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("sheetMusic.loadSong")}
        </div>
      )}

      {/* Screen reader: announce current measure (only on measure change) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {cursorPosition ? `Measure ${activeMeasureIndex + 1}` : ""}
      </div>

      {vexflowError && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center h-full gap-1 text-sm font-body"
          style={{ color: "var(--color-text-muted)" }}
          role="alert"
        >
          <span style={{ color: "var(--color-hit-line, #E07373)" }}>
            {t("sheetMusic.vexflowError")}
          </span>
          <span className="text-xs opacity-70">
            {t("sheetMusic.vexflowErrorHint")}
          </span>
        </div>
      )}
    </div>
  );
}
