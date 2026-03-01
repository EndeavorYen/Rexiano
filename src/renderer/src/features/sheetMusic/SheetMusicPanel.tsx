/**
 * SheetMusicPanel — Renders sheet music with VexFlow 5.
 *
 * Renders notation data into SVG using VexFlow, with cursor
 * tracking synchronized to playback position.
 *
 * Supports three display modes (controlled by parent):
 * - split: sheet music shown above falling notes
 * - sheet: sheet music only (full height)
 * - falling: hidden (falling notes only — current default)
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type {
  NotationData,
  NotationMeasure,
  NotationNote,
  DisplayMode,
} from "./types";
import type { CursorPosition } from "./CursorSync";

/** Layout constants */
const STAVE_HEIGHT = 80;
const SYSTEM_GAP = 20;
const SYSTEM_HEIGHT = STAVE_HEIGHT * 2 + SYSTEM_GAP;
const LEFT_MARGIN = 10;
const TOP_MARGIN = 10;
const MIN_MEASURE_WIDTH = 180;

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

/**
 * Group notes that start at the same tick into chords.
 * Returns an array of { keys[], duration } objects.
 */
function groupNotesIntoChords(
  notes: NotationNote[],
): { keys: string[]; duration: string }[] {
  if (notes.length === 0) return [];

  const sorted = [...notes].sort((a, b) => a.startTick - b.startTick);
  const groups: { keys: string[]; duration: string; startTick: number }[] = [];

  for (const note of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.startTick === note.startTick) {
      last.keys.push(note.vexKey);
    } else {
      groups.push({
        keys: [note.vexKey],
        duration: note.vexDuration,
        startTick: note.startTick,
      });
    }
  }

  return groups.map((g) => ({ keys: g.keys, duration: g.duration }));
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
): void {
  const { Stave, StaveNote, Voice, Formatter, StaveConnector } = VF;

  // Create treble stave
  const treble = new Stave(x, y, width);
  if (isFirst) {
    treble
      .addClef("treble")
      .addTimeSignature(
        `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`,
      );
  }
  treble.setContext(context).draw();

  // Create bass stave
  const bass = new Stave(x, y + STAVE_HEIGHT + SYSTEM_GAP, width);
  if (isFirst) {
    bass
      .addClef("bass")
      .addTimeSignature(
        `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`,
      );
  }
  bass.setContext(context).draw();

  // Draw brace connector on first measure
  if (isFirst) {
    new StaveConnector(treble, bass)
      .setType("brace")
      .setContext(context)
      .draw();
  }
  // Draw bar line connector
  new StaveConnector(treble, bass)
    .setType("singleRight")
    .setContext(context)
    .draw();

  // Build treble notes
  const trebleChords = groupNotesIntoChords(measure.trebleNotes);
  const trebleVexNotes =
    trebleChords.length > 0
      ? trebleChords.map(
          (c) => new StaveNote({ keys: c.keys, duration: c.duration }),
        )
      : [
          new StaveNote({
            keys: [makeRestKey("treble")],
            duration: "wr",
          }),
        ];

  // Build bass notes
  const bassChords = groupNotesIntoChords(measure.bassNotes);
  const bassVexNotes =
    bassChords.length > 0
      ? bassChords.map(
          (c) =>
            new StaveNote({
              keys: c.keys,
              duration: c.duration,
              clef: "bass",
            }),
        )
      : [
          new StaveNote({
            keys: [makeRestKey("bass")],
            duration: "wr",
            clef: "bass",
          }),
        ];

  // Create voices (non-strict to allow partial measures)
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

  // Format
  const staveWidth = width - (isFirst ? 80 : 20);
  new Formatter()
    .joinVoices([trebleVoice])
    .joinVoices([bassVoice])
    .format([trebleVoice, bassVoice], Math.max(staveWidth, 60));

  // Draw
  trebleVoice.draw(context, treble);
  bassVoice.draw(context, bass);

  // Highlight current measure
  if (isHighlighted) {
    context.save();
    context.setFillStyle("rgba(var(--accent-rgb, 99,102,241), 0.08)");
    context.fillRect(x, y, width, STAVE_HEIGHT * 2 + SYSTEM_GAP);
    context.restore();
  }
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

  // Track container width with ResizeObserver
  const resizeRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // VexFlow rendering
  useEffect(() => {
    const el = containerRef.current;
    if (hidden || !el || !notationData || notationData.measures.length === 0)
      return;

    // Dynamic import of VexFlow (wait for music font glyphs to load)
    let cancelled = false;
    void import("vexflow").then(async (VF) => {
      // VexFlow loads music fonts (Bravura etc.) from CDN asynchronously.
      // Wait for all fonts to be ready before rendering to avoid X noteheads.
      await document.fonts.ready;
      if (cancelled || !containerRef.current) return;

      const { Renderer } = VF;

      // Clear previous rendering
      el.innerHTML = "";

      const measuresPerLine = Math.max(
        1,
        Math.floor(containerWidth / MIN_MEASURE_WIDTH),
      );
      const measureWidth = Math.floor(
        (containerWidth - LEFT_MARGIN * 2) / measuresPerLine,
      );
      const lineCount = Math.ceil(
        notationData.measures.length / measuresPerLine,
      );
      const totalHeight = lineCount * (SYSTEM_HEIGHT + 40) + TOP_MARGIN * 2;

      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(containerWidth, Math.max(totalHeight, height));
      const context = renderer.getContext();

      // Render each measure
      notationData.measures.forEach((measure, i) => {
        const lineIndex = Math.floor(i / measuresPerLine);
        const colIndex = i % measuresPerLine;
        const x = LEFT_MARGIN + colIndex * measureWidth;
        const y = TOP_MARGIN + lineIndex * (SYSTEM_HEIGHT + 40);
        const isFirst = colIndex === 0;
        const isHighlighted = cursorPosition?.measureIndex === i;

        try {
          renderMeasure(
            VF,
            context,
            measure,
            x,
            y,
            measureWidth,
            isFirst,
            isHighlighted,
          );
        } catch (e) {
          console.warn(`SheetMusic: failed to render measure ${i}:`, e);
        }
      });
    });

    return () => {
      cancelled = true;
      el.innerHTML = "";
    };
  }, [hidden, notationData, cursorPosition, containerWidth, height]);

  // Auto-scroll to current measure
  useEffect(() => {
    if (!cursorPosition || !containerRef.current || hidden) return;

    const measuresPerLine = Math.max(
      1,
      Math.floor(containerWidth / MIN_MEASURE_WIDTH),
    );
    const lineIndex = Math.floor(cursorPosition.measureIndex / measuresPerLine);
    const targetY = TOP_MARGIN + lineIndex * (SYSTEM_HEIGHT + 40);

    const el = containerRef.current;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;

    if (targetY < viewTop || targetY + SYSTEM_HEIGHT > viewBottom) {
      el.scrollTo({
        top: Math.max(0, targetY - 20),
        behavior: "smooth",
      });
    }
  }, [cursorPosition, containerWidth, hidden]);

  if (hidden) return null;

  return (
    <div
      ref={resizeRef}
      className="w-full overflow-auto"
      style={{
        height: mode === "sheet" ? "100%" : height,
        background: "var(--color-surface)",
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
