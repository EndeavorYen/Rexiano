/**
 * SheetMusicPanel — Renders sheet music with VexFlow 5.
 *
 * Rendering model:
 * - Displays an adaptive number of measure slots based on note density.
 * - On the last measure of a group, preload the next measures while
 *   keeping the current one as anchor.
 * - Displays measure numbers on odd measures (1, 3, 5, ...) above treble staff.
 * - Subtly highlights currently active measure + note/chord.
 */

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import { themes } from "@renderer/themes/tokens";
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
import {
  accidentalToDisplay,
  isDottedDuration,
  baseDuration,
  makeRestKey,
  hexToRgba,
} from "./sheetMusicHelpers";
import type {
  VexFlowModule,
  VFRenderContext,
  VFStave,
  VFStaveNote,
  VFVoice,
} from "./vexflowTypes";

/**
 * Cached VexFlow module import + fonts.ready to avoid repeated async overhead.
 *
 * Exposed via `_resetVexFlowCache()` for test isolation.
 */
let _vexflowCache: Promise<VexFlowModule> | null = null;
function loadVexFlow(): Promise<VexFlowModule> {
  if (!_vexflowCache) {
    _vexflowCache = import("vexflow")
      .then(async (VF) => {
        await document.fonts.ready;
        return VF as unknown as VexFlowModule;
      })
      .catch((err) => {
        _vexflowCache = null; // Clear cache so next attempt retries
        throw err;
      });
  }
  return _vexflowCache;
}

/* R1-04 fix: removed _resetVexFlowCache + void trick.
 * Tests mock loadVexFlow directly via vi.mock — no cache reset needed. */

/** Layout constants */
const STAVE_HEIGHT = 80;
const SYSTEM_GAP = 20;
const SYSTEM_HEIGHT = STAVE_HEIGHT * 2 + SYSTEM_GAP;
const LEFT_MARGIN = 28;
const TOP_MARGIN = 10;
const MAX_DISPLAY_MEASURES = 8;
const FIRST_MEASURE_MIN_WIDTH = 220;

/**
 * Pixels per unique onset (chord position) needed for readable spacing.
 * With beamed 16th notes (4 per beat, 16 onsets per 4/4 measure), each
 * onset needs ~20px for the notehead + beam + stem.
 */
const PX_PER_ONSET = 20;
const ACTIVE_NOTEHEAD_STROKE_WIDTH_PX = 2.2;
const ACTIVE_NOTEHEAD_GLOW_BLUR_PX = 4.2;
const ACTIVE_BEAT_SNAP_RATIO = 0.62;
const ACTIVE_BEAT_MATCH_TICK_EPSILON = 1;

/* Pure utility functions (extractAccidental, parseVexKey, accidentalToDisplay,
 * isDottedDuration, baseDuration, makeRestKey, hexToRgba) are imported from
 * ./sheetMusicHelpers — extracted for testability (R1-08). */

/** Available zoom levels for sheet music display */
const ZOOM_LEVELS = [0.75, 1.0, 1.25, 1.5] as const;

/** R3-03 fix: module-level pure function for counting unique onset ticks. */
function countOnsets(notes: { isRest?: boolean; startTick: number }[]): number {
  const seen = new Set<number>();
  for (const n of notes) {
    if (!n.isRest) seen.add(n.startTick);
  }
  return seen.size;
}

interface SheetMusicPanelProps {
  notationData: NotationData | null;
  mode: DisplayMode;
  height?: number;
}

/** Return value from renderMeasure for post-render passes (ties, beams). */
interface MeasureRenderResult {
  trebleVexNotes: VFStaveNote[];
  bassVexNotes: VFStaveNote[];
  trebleChords: ChordGroup[];
  bassChords: ChordGroup[];
  trebleStave: VFStave;
  bassStave: VFStave;
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

/**
 * Cached per-measure chord + VexFlow note data for the lightweight
 * beat-highlight overlay effect, keyed by measure index.
 *
 * Stored in a ref (not state) to avoid triggering re-renders.
 */
interface MeasureHighlightData {
  trebleChords: ChordGroup[];
  bassChords: ChordGroup[];
  trebleVexNotes: VFStaveNote[];
  bassVexNotes: VFStaveNote[];
  ticksPerBeat: number;
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
  vexNotes: VFStaveNote[],
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

    // R1-03 fix: VFStaveNote type provides compile-time safety
    const vexNote = vexNotes[i];
    if (!vexNote) continue;

    const headX = vexNote.getAbsoluteX();
    const glyphWidth = vexNote.getGlyphWidth();
    const ys = vexNote.getYs();
    if (!Number.isFinite(headX) || !Number.isFinite(glyphWidth)) continue;
    if (ys.length === 0) continue;

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

function buildTickAnchorsFromRenderedNotes(
  totalTicks: number,
  noteStartX: number,
  noteEndX: number,
  trebleChords: ChordGroup[],
  trebleVexNotes: VFStaveNote[],
  bassChords: ChordGroup[],
  bassVexNotes: VFStaveNote[],
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
  const collect = (chords: ChordGroup[], vexNotes: VFStaveNote[]): void => {
    for (let i = 0; i < chords.length; i++) {
      const chord = chords[i];
      const vexNote = vexNotes[i];
      if (!chord || !vexNote) continue;
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
  VF: VexFlowModule,
  chord: ChordGroup,
  clef: "treble" | "bass" = "treble",
  keySignature: string | undefined,
  accidentalState: Map<string, string>,
  continuationKeys?: Set<string>,
): VFStaveNote {
  const { StaveNote, Accidental, Dot } = VF;
  const dotted = isDottedDuration(chord.duration);
  const duration = dotted ? baseDuration(chord.duration) : chord.duration;

  const noteOpts = {
    keys: chord.keys,
    duration,
    ...(clef === "bass" ? { clef: "bass" as const } : {}),
  };

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
  VF: VexFlowModule,
  context: VFRenderContext,
  measure: NotationMeasure,
  x: number,
  y: number,
  width: number,
  isFirst: boolean,
  ticksPerQuarter: number,
  trebleContinuationKeys: Set<string>,
  bassContinuationKeys: Set<string>,
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

  // R1-02 fix: shared stave setup — eliminates 20-line duplication
  const timeSigStr = `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`;
  const setupStave = (stave: VFStave, clef: string): void => {
    if (isFirst) {
      stave.addClef(clef);
      if (showKeySig) stave.addKeySignature(measure.keySignature);
      stave.addTimeSignature(timeSigStr);
    } else {
      if (keySigChanged) stave.addKeySignature(measure.keySignature);
      if (timeSigChanged) stave.addTimeSignature(timeSigStr);
    }
    stave.setContext(context).draw();
  };

  const treble = new Stave(x, y, width);
  setupStave(treble, "treble");

  const bass = new Stave(x, y + STAVE_HEIGHT + SYSTEM_GAP, width);
  setupStave(bass, "bass");

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

  // Draw measure number above treble staff
  if (measureNumber !== undefined) {
    const svg = context.svg;
    if (svg) {
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      text.setAttribute("x", String(x + 4));
      text.setAttribute("y", String(y - 2));
      text.setAttribute("font-size", "10");
      text.setAttribute("font-family", "'DM Sans', 'Nunito', sans-serif");
      text.setAttribute("fill", "var(--color-text-muted)");
      text.setAttribute("opacity", "0.7");
      text.textContent = String(measureNumber);
      svg.appendChild(text);
    }
  }

  // Build a set of staccato tick positions from expression marks.
  // R3-01 fix: Use normalizeTickInMeasure for BOTH build and lookup to
  // guarantee matching. Previous code used a separate beat-fraction
  // calculation that could diverge due to rounding differences.
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
        // Convert beat position to a tick offset, then normalize with the
        // same function used for chord lookup, ensuring exact match.
        const beatTick = Math.round(
          (expr.beat / beatsPerMeasure) * ticksPerMeasure,
        );
        const normalized = normalizeTickInMeasure(
          beatTick,
          ticksPerQuarter,
          measure.timeSignatureTop,
          measure.timeSignatureBottom,
        );
        staccatoTicks.add(normalized);
      }
    }
  }

  // R2-01 fix: shared helper for chord→VexNote mapping + articulation
  const buildVoiceNotes = (
    notes: NotationMeasure["trebleNotes"],
    clef: "treble" | "bass",
    continuationKeys: Set<string>,
  ): { chords: ChordGroup[]; vexNotes: VFStaveNote[] } => {
    const chords = groupNotesIntoChords(notes);
    const accState = new Map<string, string>();
    const vexNotes: VFStaveNote[] =
      chords.length > 0
        ? chords.map((chord) => {
            const note = createVexNote(
              VF,
              chord,
              clef,
              measure.keySignature,
              accState,
              continuationKeys,
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
            new StaveNote({
              keys: [makeRestKey(clef)],
              duration: "wr",
              ...(clef === "bass" ? { clef: "bass" as const } : {}),
            }),
          ];
    return { chords, vexNotes };
  };

  const { chords: trebleChords, vexNotes: trebleVexNotes } = buildVoiceNotes(
    measure.trebleNotes,
    "treble",
    trebleContinuationKeys,
  );
  const { chords: bassChords, vexNotes: bassVexNotes } = buildVoiceNotes(
    measure.bassNotes,
    "bass",
    bassContinuationKeys,
  );

  // R3-02 fix: shared voice creation pattern
  const createVoice = (notes: VFStaveNote[]): VFVoice => {
    const v = new Voice({
      numBeats: measure.timeSignatureTop,
      beatValue: measure.timeSignatureBottom,
    }).setStrict(false);
    v.addTickables(notes);
    return v;
  };
  const trebleVoice = createVoice(trebleVexNotes);
  const bassVoice = createVoice(bassVexNotes);

  const formatter = new Formatter({ softmaxFactor: 5 })
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
  // Pass beat-based grouping so VexFlow beams 8th/16th notes per beat
  // (e.g. 4 sixteenths per beat in 4/4). maintainStemDirections preserves
  // treble-up / bass-down orientation set during StaveNote creation.
  //
  // R1-04 FIX: Guard beam path with chord length check and use proper
  // index-aligned filtering. Added console.warn for debugging beam failures.
  try {
    const { Beam } = VF;
    if (Beam) {
      const timeSig = `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`;
      const groups = Beam.getDefaultBeamGroups(timeSig);

      const drawBeams = (
        vexNotes: VFStaveNote[],
        chords: ChordGroup[],
      ): void => {
        // Only attempt beaming when there are real chords (not the whole-rest fallback)
        if (chords.length === 0) return;
        // Filter notes using index-aligned access to chords.
        // When chords.length < vexNotes.length (due to rest fallback), the
        // `chords[i]` guard safely returns undefined, skipping the extra note.
        const nonRestNotes = vexNotes.filter(
          (_n: VFStaveNote, i: number) =>
            i < chords.length && chords[i] && !chords[i].duration.includes("r"),
        );
        if (nonRestNotes.length > 1) {
          const beams = Beam.generateBeams(nonRestNotes, {
            groups,
            maintainStemDirections: true,
          });
          beams.forEach((b) => b.setContext(context).draw());
        }
      };
      drawBeams(trebleVexNotes, trebleChords);
      drawBeams(bassVexNotes, bassChords);
    }
  } catch (beamError: unknown) {
    console.warn("SheetMusic: beam generation failed:", beamError);
  }

  // Render text-based expression marks (rit., accel., legato) above the treble staff
  if (expressions && expressions.length > 0) {
    const svg = context.svg;
    if (svg) {
      const beatsPerMeasure = measure.timeSignatureTop;
      for (const expr of expressions) {
        // Only render tempo-related text marks (rit., accel.); skip staccato
        // (handled as note articulation) and legato (too noisy for dense pieces).
        if (expr.type === "staccato" || expr.type === "legato") continue;

        // R1-01 fix: map expression types to display labels explicitly.
        // Previous code had unreachable "legato" fallback (legato is skipped above).
        const labelMap: Record<string, string> = {
          rit: "rit.",
          accel: "accel.",
        };
        const label = labelMap[expr.type] ?? expr.type;
        const isItalic = true; // All remaining expression marks are italic
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
        text.setAttribute("fill", "var(--color-accent)");
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
  VF: VexFlowModule,
  context: VFRenderContext,
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
  /**
   * Ref holding per-measure chord + VexFlow note references for the
   * lightweight beat-highlight overlay. Updated by the main VexFlow render
   * effect; consumed by the separate highlight effect that runs on every
   * beat change without rebuilding the SVG.
   */
  const highlightDataRef = useRef<Record<number, MeasureHighlightData>>({});
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

  /**
   * Read accent color directly from theme tokens instead of DOM.
   *
   * R1-07 FIX: Previously used getComputedStyle (DOM side effect) inside
   * useMemo, which is unsafe in React concurrent mode. Now reads from
   * the imported `themes` token map, which is a pure data lookup.
   */
  const accentHex = useMemo(() => {
    const t = themes[themeId];
    return t?.colors.accent ?? "#1E6E72";
  }, [themeId]);

  const cursorPosition = useMemo(() => {
    if (!notationData) return null;
    return getCursorPosition(currentTime, notationData);
  }, [currentTime, notationData]);
  const activeMeasureIndex = cursorPosition?.measureIndex ?? 0;

  const availableWidth = Math.max(
    1,
    Math.floor(containerWidth - LEFT_MARGIN * 2),
  );

  // R2-05 FIX: Pre-compute the density sampling window start so that
  // `displayMeasureCount` only recomputes at group boundaries (every 8
  // measures), not on every single measure transition. This avoids
  // unnecessary Set allocations on every measure change.
  const densitySampleStart = useMemo(
    () =>
      Math.floor(activeMeasureIndex / MAX_DISPLAY_MEASURES) *
      MAX_DISPLAY_MEASURES,
    [activeMeasureIndex],
  );

  // Adaptive measure count: compute how many measures fit based on note density.
  // Dense measures (16th notes) get fewer measures per screen for readability.
  const displayMeasureCount = useMemo(() => {
    if (!notationData || notationData.measures.length === 0)
      return MAX_DISPLAY_MEASURES;

    // Sample the measures around the active index to estimate density.
    // Count unique onset ticks per stave (simultaneous notes stack vertically).
    const total = notationData.measures.length;
    let totalOnsets = 0;
    let sampleCount = 0;
    for (
      let i = densitySampleStart;
      i < densitySampleStart + MAX_DISPLAY_MEASURES && i < total;
      i++
    ) {
      const m = notationData.measures[i];
      const trebleOnsets = countOnsets(m.trebleNotes);
      const bassOnsets = countOnsets(m.bassNotes);
      totalOnsets += Math.max(trebleOnsets, bassOnsets);
      sampleCount++;
    }

    if (sampleCount === 0) return MAX_DISPLAY_MEASURES;
    const avgOnsetsPerMeasure = totalOnsets / sampleCount;
    const neededPerMeasure = avgOnsetsPerMeasure * PX_PER_ONSET;
    const effectiveWidth = availableWidth - FIRST_MEASURE_MIN_WIDTH;
    // First measure takes FIRST_MEASURE_MIN_WIDTH; rest share the remainder
    const fittable =
      neededPerMeasure > 0
        ? 1 + Math.floor(effectiveWidth / neededPerMeasure)
        : MAX_DISPLAY_MEASURES;

    return Math.max(2, Math.min(MAX_DISPLAY_MEASURES, fittable));
  }, [notationData, densitySampleStart, availableWidth]);

  /**
   * Compute a stable display window key to prevent unnecessary VexFlow re-renders.
   *
   * R1-02 FIX: `getMeasureWindow` returns a new array every call, which
   * caused the VexFlow render effect to fire on every measure transition
   * (every ~2s at 120 BPM). We now derive a stable string key from the
   * window contents. The `visibleMeasures` array is only recomputed when
   * the key changes (typically only on page flips, a few times per minute).
   */
  const displayWindowKey = useMemo(() => {
    if (!notationData || notationData.measures.length === 0) return "";
    // J1-01 FIX: Renamed from `window` to `measureWindow` to avoid
    // shadowing the global `window` object.
    const measureWindow = getMeasureWindow(
      activeMeasureIndex,
      notationData.measures.length,
      displayMeasureCount,
    );
    return measureWindow.join(",");
  }, [notationData, activeMeasureIndex, displayMeasureCount]);

  const visibleMeasures = useMemo(() => {
    if (!displayWindowKey) return [];
    return displayWindowKey.split(",").map(Number);
  }, [displayWindowKey]);

  const rawSlotWidths = useMemo(() => {
    const noteCounts = Array.from(
      { length: displayMeasureCount },
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
  }, [availableWidth, displayMeasureCount, notationData, visibleMeasures]);
  const slotWidths = useMemo(() => {
    if (rawSlotWidths.length === 0) return rawSlotWidths;
    const next = [...rawSlotWidths];
    next[0] = Math.max(next[0], FIRST_MEASURE_MIN_WIDTH);
    return next;
  }, [rawSlotWidths]);
  const slotLefts = useMemo(() => {
    const lefts: number[] = [];
    let cursor = LEFT_MARGIN;
    for (let i = 0; i < displayMeasureCount; i++) {
      lefts.push(cursor);
      cursor += slotWidths[i] ?? 0;
    }
    return lefts;
  }, [displayMeasureCount, slotWidths]);
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

  /**
   * Observe container width for responsive layout.
   *
   * R1-09 FIX: Deduplicate width changes by only calling setContainerWidth
   * when the rounded width actually changes. ResizeObserver can fire on
   * every animation frame during smooth resize, and each call previously
   * triggered a full VexFlow SVG rebuild.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let lastWidth = 0;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w !== lastWidth) {
          lastWidth = w;
          setContainerWidth(w);
        }
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
    if (
      hidden ||
      !svgHostRef.current ||
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

        for (let slot = 0; slot < displayMeasureCount; slot++) {
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
          for (let slot = 0; slot < displayMeasureCount - 1; slot++) {
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

        /**
         * R1-01 FIX: Read svgHostRef.current at mutation time, not the
         * captured `host` from effect entry. If the component unmounts/
         * remounts during the async VexFlow load, `host` would be stale
         * but `svgHostRef.current` reflects the current DOM node.
         */
        // Populate highlight data ref for the lightweight beat-highlight effect.
        // This stores chord groups and rendered VexFlow note elements per
        // measure so the overlay can be computed without rebuilding the SVG.
        const nextHighlightData: Record<number, MeasureHighlightData> = {};
        for (let slot = 0; slot < displayMeasureCount; slot++) {
          const mIdx = slotMeasureIndices[slot];
          const result = slotResults[slot];
          if (mIdx === undefined || !result || !notationData) continue;
          const m = notationData.measures[mIdx];
          if (!m) continue;
          const tpb =
            notationData.ticksPerQuarter *
            (4 / Math.max(1, m.timeSignatureBottom));
          nextHighlightData[mIdx] = {
            trebleChords: result.trebleChords,
            bassChords: result.bassChords,
            trebleVexNotes: result.trebleVexNotes,
            bassVexNotes: result.bassVexNotes,
            ticksPerBeat: tpb,
          };
        }
        highlightDataRef.current = nextHighlightData;

        const currentHost = svgHostRef.current;
        if (cancelled || !currentHost) return;
        const nextSvg = stage.querySelector("svg");
        if (nextSvg) {
          currentHost.replaceChildren(nextSvg);
        } else {
          currentHost.replaceChildren();
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
    displayMeasureCount,
    height,
    slotLefts,
    slotWidths,
    totalHeight,
    visibleMeasures,
    accentHex,
  ]);

  /**
   * Lightweight beat-highlight overlay effect.
   *
   * R2-01 FIX: This effect runs on every beat change (2-4x/sec at 120 BPM)
   * but does NOT rebuild VexFlow staves/voices/notes/beams. Instead it:
   *   1. Queries the existing SVG in svgHostRef
   *   2. Removes any previous highlight `<g>` layer
   *   3. Computes notehead highlights from the cached chord/vexNote data
   *   4. Injects a new highlight `<g>` overlay into the existing SVG
   *
   * This is O(chords-in-active-measure) per beat, vs O(all-visible-measures)
   * for a full VexFlow rebuild.
   */
  useEffect(() => {
    const host = svgHostRef.current;
    if (!host) return;
    const svg = host.querySelector("svg");
    if (!svg) return;

    // Remove any existing highlight layer
    const existing = svg.querySelector("g[data-rx-notehead-highlight-layer]");
    if (existing) existing.remove();

    // Nothing to highlight if no active beat
    if (activeBeatMeasureIndex < 0 || activeBeatTick === null) return;

    const data = highlightDataRef.current[activeBeatMeasureIndex];
    if (!data) return;

    const highlights = [
      ...collectNoteHeadHighlights(
        data.trebleChords,
        data.trebleVexNotes,
        data.ticksPerBeat,
        true,
        activeBeatTick,
      ),
      ...collectNoteHeadHighlights(
        data.bassChords,
        data.bassVexNotes,
        data.ticksPerBeat,
        true,
        activeBeatTick,
      ),
    ];

    if (highlights.length === 0) return;

    // Inject highlight overlay using the SVG directly (no VFRenderContext needed)
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
      ring.setAttribute(
        "stroke-width",
        String(ACTIVE_NOTEHEAD_STROKE_WIDTH_PX),
      );
      ring.setAttribute("opacity", "0.96");
      ring.setAttribute(
        "style",
        `filter: drop-shadow(0 0 ${ACTIVE_NOTEHEAD_GLOW_BLUR_PX}px ${accentHex});`,
      );
      group.appendChild(ring);
    }

    svg.appendChild(group);
  }, [activeBeatMeasureIndex, activeBeatTick, accentHex]);

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
