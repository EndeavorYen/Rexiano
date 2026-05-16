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
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import type {
  NotationData,
  NotationMeasure,
  NotationNote,
  DisplayMode,
} from "./types";
import { getCursorPosition, getMeasureWindow } from "./CursorSync";

/** Layout constants */
const STAVE_HEIGHT = 80;
const SYSTEM_GAP = 20;
const SYSTEM_HEIGHT = STAVE_HEIGHT * 2 + SYSTEM_GAP;
const LEFT_MARGIN = 28;
const TOP_MARGIN = 10;
const DISPLAY_MEASURE_COUNT = 4;

interface SheetMusicPanelProps {
  notationData: NotationData | null;
  mode: DisplayMode;
  height?: number;
}

interface ChordGroup {
  keys: string[];
  duration: string;
  startTick: number;
  durationTicks: number;
  isRest: boolean;
  tiedFromPrevious: boolean;
  tiedToNext: boolean;
}

interface RenderedVoice {
  groups: ChordGroup[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vexNotes: any[];
}

interface RenderedMeasure {
  measureIndex: number;
  treble: RenderedVoice;
  bass: RenderedVoice;
}

/**
 * Group notes that start at the same tick into chords.
 */
function groupNotesIntoChords(notes: NotationNote[]): ChordGroup[] {
  if (notes.length === 0) return [];

  const sorted = [...notes].sort(
    (a, b) =>
      a.startTick - b.startTick ||
      Number(a.isRest) - Number(b.isRest) ||
      (a.midi ?? -1) - (b.midi ?? -1),
  );
  const groups: ChordGroup[] = [];

  for (const note of sorted) {
    const last = groups[groups.length - 1];
    if (
      last &&
      !last.isRest &&
      !note.isRest &&
      last.startTick === note.startTick &&
      last.duration === note.vexDuration
    ) {
      last.keys.push(note.vexKey);
      last.durationTicks = Math.max(last.durationTicks, note.durationTicks);
      last.tiedFromPrevious ||= note.tiedFromPrevious;
      last.tiedToNext ||= note.tiedToNext;
    } else {
      groups.push({
        keys: [note.vexKey],
        duration: note.vexDuration,
        startTick: note.startTick,
        durationTicks: note.durationTicks,
        isRest: note.isRest,
        tiedFromPrevious: note.tiedFromPrevious,
        tiedToNext: note.tiedToNext,
      });
    }
  }

  return groups;
}

function getAccidental(key: string): string | null {
  const match = /^[a-g]([#b]+)?\/-?\d+$/.exec(key);
  return match?.[1] ?? null;
}

function makeStaveNote(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VF: any,
  group: ChordGroup,
  clef: "treble" | "bass",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { StaveNote, Accidental } = VF;
  const keys = [...group.keys];
  const note = new StaveNote({
    keys,
    duration: `${group.duration}${group.isRest ? "r" : ""}`,
    clef,
  });

  if (!group.isRest) {
    keys.forEach((key, index) => {
      const accidental = getAccidental(key);
      if (accidental) {
        note.addModifier(new Accidental(accidental), index);
      }
    });
  }

  return note;
}

function drawBeams(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VF: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  groups: ChordGroup[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vexNotes: any[],
): void {
  const { Beam } = VF;
  let run: unknown[] = [];

  const flush = (): void => {
    if (run.length > 1) {
      for (const beam of Beam.generateBeams(run)) {
        beam.setContext(context).draw();
      }
    }
    run = [];
  };

  groups.forEach((group, index) => {
    if (!group.isRest && (group.duration === "8" || group.duration === "16")) {
      run.push(vexNotes[index]);
    } else {
      flush();
    }
  });
  flush();
}

function drawTies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VF: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  groups: ChordGroup[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vexNotes: any[],
): void {
  for (let i = 0; i < groups.length - 1; i++) {
    drawTieBetweenGroups(
      VF,
      context,
      groups[i],
      vexNotes[i],
      groups[i + 1],
      vexNotes[i + 1],
    );
  }
}

function drawTieBetweenGroups(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VF: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  current: ChordGroup,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentNote: any,
  next: ChordGroup,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nextNote: any,
): void {
  if (
    current.isRest ||
    next.isRest ||
    !current.tiedToNext ||
    !next.tiedFromPrevious
  ) {
    return;
  }

  const firstIndices: number[] = [];
  const lastIndices: number[] = [];
  current.keys.forEach((key, firstIndex) => {
    const lastIndex = next.keys.indexOf(key);
    if (lastIndex >= 0) {
      firstIndices.push(firstIndex);
      lastIndices.push(lastIndex);
    }
  });
  if (firstIndices.length === 0) return;

  new VF.StaveTie({
    first_note: currentNote,
    last_note: nextNote,
    first_indices: firstIndices,
    last_indices: lastIndices,
  })
    .setContext(context)
    .draw();
}

function drawCrossMeasureTies(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VF: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  renderedMeasures: RenderedMeasure[],
): void {
  for (let i = 0; i < renderedMeasures.length - 1; i++) {
    const current = renderedMeasures[i];
    const next = renderedMeasures[i + 1];
    if (next.measureIndex !== current.measureIndex + 1) continue;

    drawCrossVoiceTie(VF, context, current.treble, next.treble);
    drawCrossVoiceTie(VF, context, current.bass, next.bass);
  }
}

function drawCrossVoiceTie(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VF: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
  current: RenderedVoice,
  next: RenderedVoice,
): void {
  const currentIndex = findLastTieIndex(current.groups);
  const nextIndex = findFirstTieIndex(next.groups);
  if (currentIndex < 0 || nextIndex < 0) return;

  drawTieBetweenGroups(
    VF,
    context,
    current.groups[currentIndex],
    current.vexNotes[currentIndex],
    next.groups[nextIndex],
    next.vexNotes[nextIndex],
  );
}

function findLastTieIndex(groups: ChordGroup[]): number {
  for (let i = groups.length - 1; i >= 0; i--) {
    if (!groups[i].isRest && groups[i].tiedToNext) return i;
  }
  return -1;
}

function findFirstTieIndex(groups: ChordGroup[]): number {
  for (let i = 0; i < groups.length; i++) {
    if (!groups[i].isRest && groups[i].tiedFromPrevious) return i;
  }
  return -1;
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
): RenderedMeasure {
  const { Stave, Voice, Formatter, StaveConnector } = VF;

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
  const trebleVexNotes: any[] = trebleChords.map((chord) =>
    makeStaveNote(VF, chord, "treble"),
  );

  const bassChords = groupNotesIntoChords(measure.bassNotes);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bassVexNotes: any[] = bassChords.map((chord) =>
    makeStaveNote(VF, chord, "bass"),
  );

  const trebleVoice = new Voice({
    num_beats: measure.timeSignatureTop,
    beat_value: measure.timeSignatureBottom,
  });
  trebleVoice.addTickables(trebleVexNotes);

  const bassVoice = new Voice({
    num_beats: measure.timeSignatureTop,
    beat_value: measure.timeSignatureBottom,
  });
  bassVoice.addTickables(bassVexNotes);

  const staveWidth = width - (isFirst ? 80 : 20);
  new Formatter()
    .joinVoices([trebleVoice])
    .joinVoices([bassVoice])
    .format([trebleVoice, bassVoice], Math.max(staveWidth, 60));

  trebleVoice.draw(context, treble);
  bassVoice.draw(context, bass);
  drawBeams(VF, context, trebleChords, trebleVexNotes);
  drawBeams(VF, context, bassChords, bassVexNotes);
  drawTies(VF, context, trebleChords, trebleVexNotes);
  drawTies(VF, context, bassChords, bassVexNotes);

  return {
    measureIndex: measure.index,
    treble: { groups: trebleChords, vexNotes: trebleVexNotes },
    bass: { groups: bassChords, vexNotes: bassVexNotes },
  };
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
  mode,
  height = 220,
}: SheetMusicPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const hidden = mode === "falling";
  const cursorPosition = useMemo(() => {
    if (!notationData) return null;
    return getCursorPosition(currentTime, notationData);
  }, [currentTime, notationData]);
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
    void import("vexflow")
      .then(async (VF) => {
        await document.fonts.ready;
        if (cancelled || !svgHostRef.current) return;

        const { Renderer } = VF;
        const stage = document.createElement("div");
        const renderer = new Renderer(stage, Renderer.Backends.SVG);
        renderer.resize(containerWidth, Math.max(totalHeight, height));
        const context = renderer.getContext();
        const renderedMeasures: RenderedMeasure[] = [];

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
            renderedMeasures.push(
              renderMeasure(VF, context, measure, x, y, slotWidth, isFirst),
            );
          } catch (e) {
            console.warn(
              `SheetMusic: failed to render measure ${measureIndex}:`,
              e,
            );
          }
        }
        drawCrossMeasureTies(VF, context, renderedMeasures);

        if (cancelled || !svgHostRef.current) return;
        const nextSvg = stage.querySelector("svg");
        if (nextSvg) {
          host.replaceChildren(nextSvg);
        } else {
          host.replaceChildren();
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("SheetMusic: failed to load VexFlow", err);
        }
      });

    return () => {
      cancelled = true;
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
      className="relative w-full overflow-hidden"
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
              transition: "left 120ms ease-out, width 120ms ease-out",
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
              transition: "left 120ms linear",
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
              transition: "left 120ms linear",
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
