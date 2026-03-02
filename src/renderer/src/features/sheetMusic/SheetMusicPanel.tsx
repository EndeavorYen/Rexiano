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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyActiveStyle(staveNote: any): void {
  staveNote.setStyle({
    fillStyle: "rgba(30, 110, 114, 0.68)",
    strokeStyle: "rgba(30, 110, 114, 0.86)",
    shadowColor: "rgba(30, 110, 114, 0.18)",
    shadowBlur: 3,
  });
}

/**
 * Render a single system (treble + bass) for one measure using VexFlow.
 */
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
  isHighlighted: boolean,
  activeTick: number | null,
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
          if (
            activeTick !== null &&
            activeTick >= chord.startTick &&
            activeTick < chord.startTick + chord.durationTicks
          ) {
            applyActiveStyle(note);
          }
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
          if (
            activeTick !== null &&
            activeTick >= chord.startTick &&
            activeTick < chord.startTick + chord.durationTicks
          ) {
            applyActiveStyle(note);
          }
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

  if (isHighlighted) {
    context.save();
    context.setFillStyle("rgba(30, 110, 114, 0.06)");
    context.fillRect(x, y, width, STAVE_HEIGHT * 2 + SYSTEM_GAP);
    context.restore();
  }
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
  const [containerWidth, setContainerWidth] = useState(800);
  const hidden = mode === "falling";

  const visibleMeasures = useMemo(() => {
    if (!notationData || notationData.measures.length === 0) return [];
    const currentMeasure = cursorPosition?.measureIndex ?? 0;
    return getMeasureWindow(currentMeasure, notationData.measures.length);
  }, [notationData, cursorPosition]);

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
    const el = containerRef.current;
    if (hidden || !el || !notationData || notationData.measures.length === 0)
      return;

    let cancelled = false;
    void import("vexflow").then(async (VF) => {
      await document.fonts.ready;
      if (cancelled || !containerRef.current) return;

      const { Renderer } = VF;
      el.innerHTML = "";

      const slotWidth = Math.floor(
        (containerWidth - LEFT_MARGIN * 2) / DISPLAY_MEASURE_COUNT,
      );
      const totalHeight = SYSTEM_HEIGHT + TOP_MARGIN * 2 + 16;

      const renderer = new Renderer(el, Renderer.Backends.SVG);
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
        const isHighlighted = cursorPosition?.measureIndex === measureIndex;
        const activeTick = isHighlighted
          ? (cursorPosition?.tick ?? null)
          : null;

        try {
          renderMeasure(
            VF,
            context,
            measure,
            x,
            y,
            slotWidth,
            isFirst,
            isHighlighted,
            activeTick,
          );
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
      el.innerHTML = "";
    };
  }, [
    hidden,
    notationData,
    cursorPosition,
    containerWidth,
    height,
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
      {!notationData && (
        <div
          className="flex items-center justify-center h-full text-sm font-body"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("sheetMusic.loadSong")}
        </div>
      )}
    </div>
  );
}
