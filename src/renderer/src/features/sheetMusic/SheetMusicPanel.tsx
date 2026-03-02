/**
 * SheetMusicPanel — Renders sheet music with VexFlow 5.
 *
 * Rendering model:
 * - Always displays 4 measure slots.
 * - On the 4th measure of a group, preload the next 3 measures while
 *   keeping the current one as anchor:
 *   1,2,3,4 -> 5,6,7,4 -> 5,6,7,8
 * - Subtly highlights currently active measure + note/chord.
 */

import { useRef, useEffect, useState, useMemo } from "react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type {
  NotationData,
  NotationMeasure,
  NotationNote,
  DisplayMode,
} from "./types";
import type { CursorPosition } from "./CursorSync";
import { getMeasureWindow } from "./CursorSync";

/** Layout constants */
const STAVE_HEIGHT = 80;
const SYSTEM_GAP = 20;
const SYSTEM_HEIGHT = STAVE_HEIGHT * 2 + SYSTEM_GAP;
const LEFT_MARGIN = 18;
const TOP_MARGIN = 12;
const DISPLAY_MEASURE_COUNT = 4;

const MIN_MEASURE_WIDTH = 120; // px — even an empty measure needs this much

/**
 * Allocate horizontal widths to measure slots proportionally by note density.
 * Each slot gets at least MIN_MEASURE_WIDTH.
 *
 * @param noteCounts - Number of notes per slot (use 1 for empty slots)
 * @param totalWidth - Available pixel width across all slots
 * @returns Width in pixels for each slot, summing to exactly totalWidth when
 *   totalWidth >= MIN_MEASURE_WIDTH * noteCounts.length
 */
export function calcMeasureWidths(
  noteCounts: number[],
  totalWidth: number,
): number[] {
  if (noteCounts.length === 0) return [];
  if (noteCounts.length === 1) return [totalWidth];

  const effective = noteCounts.map((c) => Math.max(c, 1));
  const sum = effective.reduce((a, b) => a + b, 0);
  const proportional = effective.map((c) => (c / sum) * totalWidth);

  // Clamp each slot to the minimum
  const clamped = proportional.map((w) => Math.max(w, MIN_MEASURE_WIDTH));

  const clampedTotal = clamped.reduce((a, b) => a + b, 0);
  if (clampedTotal <= totalWidth) {
    // Floor each, give leftover to first slot
    const floored = clamped.map(Math.floor);
    const used = floored.reduce((a, b) => a + b, 0);
    floored[0] += totalWidth - used;
    return floored;
  }

  // Total exceeds container (too many min-width slots):
  // Give every slot its minimum, then distribute whatever is left
  // proportionally among slots whose proportional share exceeds the minimum.
  const minTotal = MIN_MEASURE_WIDTH * noteCounts.length;
  const surplus = Math.max(0, totalWidth - minTotal);
  const result = effective.map((c) =>
    Math.floor(MIN_MEASURE_WIDTH + (c / sum) * surplus),
  );
  const used = result.reduce((a, b) => a + b, 0);
  result[0] = Math.max(1, result[0] + (totalWidth - used)); // distribute rounding remainder
  return result;
}

interface SheetMusicPanelProps {
  notationData: NotationData | null;
  cursorPosition: CursorPosition | null;
  mode: DisplayMode;
  height?: number;
}

/**
 * Build a VexFlow rest note at the appropriate position for the clef.
 * Uses b/4 for treble, d/3 for bass as conventional rest placement.
 */
function makeRestKey(clef: "treble" | "bass"): string {
  return clef === "treble" ? "b/4" : "d/3";
}

interface ChordGroup {
  keys: string[];
  duration: string;
  startTick: number;
  durationTicks: number;
}

/**
 * Group notes that start at the same tick into chords.
 */
function groupNotesIntoChords(notes: NotationNote[]): ChordGroup[] {
  if (notes.length === 0) return [];

  const sorted = [...notes].sort((a, b) => a.startTick - b.startTick);
  const groups: ChordGroup[] = [];

  for (const note of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.startTick === note.startTick) {
      last.keys.push(note.vexKey);
      last.durationTicks = Math.max(last.durationTicks, note.durationTicks);
    } else {
      groups.push({
        keys: [note.vexKey],
        duration: note.vexDuration,
        startTick: note.startTick,
        durationTicks: note.durationTicks,
      });
    }
  }

  return groups;
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
): void {
  const { Stave, StaveNote, Voice, Formatter, StaveConnector } = VF;

  const treble = new Stave(x, y, width);
  if (isFirst) {
    treble
      .addClef("treble")
      .addTimeSignature(
        `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`,
      );
  }
  treble.setContext(context).draw();

  const bass = new Stave(x, y + STAVE_HEIGHT + SYSTEM_GAP, width);
  if (isFirst) {
    bass
      .addClef("bass")
      .addTimeSignature(
        `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`,
      );
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

  const trebleChords = groupNotesIntoChords(measure.trebleNotes);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trebleVexNotes: any[] =
    trebleChords.length > 0
      ? trebleChords.map((chord) => {
          const note = new StaveNote({
            keys: chord.keys,
            duration: chord.duration,
          });
          return note;
        })
      : [
          new StaveNote({
            keys: [makeRestKey("treble")],
            duration: "wr",
          }),
        ];

  const bassChords = groupNotesIntoChords(measure.bassNotes);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bassVexNotes: any[] =
    bassChords.length > 0
      ? bassChords.map((chord) => {
          const note = new StaveNote({
            keys: chord.keys,
            duration: chord.duration,
            clef: "bass",
          });
          return note;
        })
      : [
          new StaveNote({
            keys: [makeRestKey("bass")],
            duration: "wr",
            clef: "bass",
          }),
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

  const staveWidth = width - (isFirst ? 80 : 20);
  new Formatter()
    .joinVoices([trebleVoice])
    .joinVoices([bassVoice])
    .format([trebleVoice, bassVoice], Math.max(staveWidth, 60));

  trebleVoice.draw(context, treble);
  bassVoice.draw(context, bass);
}

/**
 * Draw an empty slot when the song has fewer than 4 measures left.
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
): void {
  const { Stave, StaveConnector } = VF;
  const treble = new Stave(x, y, width);
  if (isFirst) {
    treble.addClef("treble").addTimeSignature("4/4");
  }
  treble.setContext(context).draw();

  const bass = new Stave(x, y + STAVE_HEIGHT + SYSTEM_GAP, width);
  if (isFirst) {
    bass.addClef("bass").addTimeSignature("4/4");
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
  cursorPosition,
  mode,
  height = 220,
}: SheetMusicPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const hidden = mode === "falling";
  const activeMeasureIndex = cursorPosition?.measureIndex ?? 0;

  const visibleMeasures = useMemo(() => {
    if (!notationData || notationData.measures.length === 0) return [];
    return getMeasureWindow(activeMeasureIndex, notationData.measures.length);
  }, [notationData, activeMeasureIndex]);

  const slotWidth = useMemo(
    () =>
      Math.floor((containerWidth - LEFT_MARGIN * 2) / DISPLAY_MEASURE_COUNT),
    [containerWidth],
  );
  const totalHeight = SYSTEM_HEIGHT + TOP_MARGIN * 2 + 16;
  const activeSlotIndex =
    cursorPosition && visibleMeasures.length > 0
      ? visibleMeasures.indexOf(cursorPosition.measureIndex)
      : -1;
  const activeMeasure =
    activeSlotIndex >= 0 && cursorPosition && notationData
      ? notationData.measures[cursorPosition.measureIndex]
      : null;
  const beatsPerMeasure = Math.max(activeMeasure?.timeSignatureTop ?? 4, 1);
  const beatRatio =
    cursorPosition && activeSlotIndex >= 0
      ? Math.max(0, Math.min(0.995, cursorPosition.beat / beatsPerMeasure))
      : 0;
  const activeMeasureLeft =
    activeSlotIndex >= 0 ? LEFT_MARGIN + activeSlotIndex * slotWidth : 0;
  const cursorLeft = activeMeasureLeft + slotWidth * beatRatio;

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

  useEffect(() => {
    const host = svgHostRef.current;
    if (
      hidden ||
      !host ||
      !notationData ||
      notationData.measures.length === 0 ||
      slotWidth <= 0
    ) {
      return;
    }

    let cancelled = false;
    void import("vexflow").then(async (VF) => {
      await document.fonts.ready;
      if (cancelled || !svgHostRef.current) return;

      const { Renderer } = VF;
      host.innerHTML = "";

      const renderer = new Renderer(host, Renderer.Backends.SVG);
      renderer.resize(containerWidth, Math.max(totalHeight, height));
      const context = renderer.getContext();

      for (let slot = 0; slot < DISPLAY_MEASURE_COUNT; slot++) {
        const measureIndex = visibleMeasures[slot];
        const x = LEFT_MARGIN + slot * slotWidth;
        const y = TOP_MARGIN;
        const isFirst = slot === 0;

        if (measureIndex === undefined) {
          renderEmptyMeasure(VF, context, x, y, slotWidth, isFirst);
          continue;
        }

        const measure = notationData.measures[measureIndex];

        try {
          renderMeasure(VF, context, measure, x, y, slotWidth, isFirst);
        } catch (e) {
          console.warn(
            `SheetMusic: failed to render measure ${measureIndex}:`,
            e,
          );
        }
      }
    });

    return () => {
      cancelled = true;
      host.innerHTML = "";
    };
  }, [
    hidden,
    notationData,
    containerWidth,
    height,
    slotWidth,
    totalHeight,
    visibleMeasures,
  ]);

  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      style={{
        flex: mode === "sheet" ? 1 : undefined,
        height: mode === "split" ? height : undefined,
        flexShrink: mode === "split" ? 0 : undefined,
        minHeight: mode === "split" ? height : undefined,
        background:
          "color-mix(in srgb, var(--color-surface) 88%, var(--color-bg))",
        borderBottom:
          mode === "split" ? "1px solid var(--color-border)" : undefined,
      }}
      data-testid="sheet-music-panel"
    >
      <div
        ref={svgHostRef}
        className="w-full h-full"
        data-testid="sheet-music-svg-host"
      />

      {activeSlotIndex >= 0 && cursorPosition && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              left: activeMeasureLeft,
              width: slotWidth,
              top: TOP_MARGIN,
              height: SYSTEM_HEIGHT,
              background: "rgba(30, 110, 114, 0.06)",
              borderRadius: 3,
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
              background:
                "linear-gradient(180deg, rgba(30, 110, 114, 0.75), rgba(30, 110, 114, 0.4))",
              borderRadius: 999,
              boxShadow: "0 0 8px rgba(30, 110, 114, 0.3)",
              transform: "translateX(-1px)",
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
              background: "rgba(30, 110, 114, 0.92)",
              boxShadow: "0 0 10px rgba(30, 110, 114, 0.35)",
            }}
            data-testid="sheet-cursor-dot"
          />
        </>
      )}

      {!notationData && (
        <div
          className="absolute inset-0 flex items-center justify-center h-full text-sm font-body"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("sheetMusic.loadSong")}
        </div>
      )}
    </div>
  );
}
