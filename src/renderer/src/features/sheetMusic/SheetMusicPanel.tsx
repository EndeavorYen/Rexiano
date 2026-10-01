/**
 * SheetMusicPanel — Renders sheet music with VexFlow 5.
 *
 * Rendering model:
 * - Always displays 4 measure slots.
 * - On the 4th measure of a group, preload future measures chronologically:
 *   1,2,3,4 -> 4,5,6,7 -> 5,6,7,8
 * - Subtly highlights currently active measure + note/chord.
 */

import { useRef, useEffect, useState, useMemo } from "react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import type { TempoMap } from "@renderer/engines/midi/TempoMap";
import type { NotationData, NotationMeasure, DisplayMode } from "./types";
import { getCursorPosition, getMeasureWindow } from "./CursorSync";
import {
  beamConfigForVoice,
  endBarlineType,
  measureNumberLabel,
  stemOptionsForGroup,
  voiceMeter,
} from "./engravingRules";
import {
  MIN_MEASURE_WIDTH,
  calcMeasureSlotLayout,
  calcSheetRenderWidth,
  calcSheetPanX,
  calcSheetScale,
  shouldRenderBassStaff,
} from "./sheetMusicUtils";
import {
  groupNotesIntoStaffVoices,
  type ChordGroup,
} from "./sheetMusicRenderUtils";
import type { Beam, RenderContext, Stave, StaveNote, Tuplet } from "vexflow";

type VexFlow = typeof import("vexflow");

/** Layout constants */
const STAVE_HEIGHT = 80;
const SYSTEM_GAP = 20;
const SYSTEM_HEIGHT = STAVE_HEIGHT * 2 + SYSTEM_GAP;
const LEFT_MARGIN = 28;
const TOP_MARGIN = 10;
const DISPLAY_MEASURE_COUNT = 4;
const SVG_BOUNDS_GUARD = 240;
const KEY_SIGNATURE_NAMES = new Map<number, string>([
  [-7, "Cb"],
  [-6, "Gb"],
  [-5, "Db"],
  [-4, "Ab"],
  [-3, "Eb"],
  [-2, "Bb"],
  [-1, "F"],
  [0, "C"],
  [1, "G"],
  [2, "D"],
  [3, "A"],
  [4, "E"],
  [5, "B"],
  [6, "F#"],
  [7, "C#"],
]);

interface SheetMusicPanelProps {
  notationData: NotationData | null;
  mode: DisplayMode;
  height?: number;
  /**
   * The song's tempo map. Required for cursor tracking to stay correct on songs
   * that change tempo; without it the cursor assumes a constant BPM.
   */
  tempoMap?: TempoMap | null;
}

interface RenderedVoice {
  voiceIndex: number;
  groups: ChordGroup[];
  vexNotes: StaveNote[];
  tuplets: Tuplet[];
  beams: Beam[];
}

interface RenderedStaff {
  voices: RenderedVoice[];
}

interface RenderedMeasure {
  measureIndex: number;
  treble: RenderedStaff;
  bass: RenderedStaff;
}

function keySignatureToVexKey(keySignature: number): string {
  const normalized = Math.max(-7, Math.min(7, Math.trunc(keySignature)));
  return KEY_SIGNATURE_NAMES.get(normalized) ?? "C";
}

function makeStaveNote(
  VF: VexFlow,
  group: ChordGroup,
  clef: "treble" | "bass",
): StaveNote {
  const { StaveNote, Accidental, Dot } = VF;
  const keys = [...group.keys];
  const note = new StaveNote({
    keys,
    duration: `${group.duration}${group.isRest ? "r" : ""}`,
    clef,
    ...stemOptionsForGroup(group),
    alignCenter: group.fullMeasureRest === true,
  });
  for (let i = 0; i < group.dots; i++) {
    Dot.buildAndAttach([note], { all: true });
  }

  if (!group.isRest) {
    group.accidentals.forEach((accidental, index) => {
      if (accidental) {
        note.addModifier(new Accidental(accidental), index);
      }
    });
  }

  return note;
}

/**
 * Build beams before the voice is drawn: VexFlow only suppresses flags and
 * settles stem sides for notes that already belong to a beam (#330).
 */
function createBeams(
  VF: VexFlow,
  groups: ChordGroup[],
  vexNotes: StaveNote[],
  timeSignature: string,
): Beam[] {
  const config = beamConfigForVoice(
    groups[0]?.stemDirection,
    timeSignature,
    VF,
    groups.some((group) => group.tuplet !== undefined),
  );
  return VF.Beam.generateBeams(vexNotes, config);
}

function drawTies(
  VF: VexFlow,
  context: RenderContext,
  groups: ChordGroup[],
  vexNotes: StaveNote[],
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

function makeTuplets(
  VF: VexFlow,
  groups: ChordGroup[],
  vexNotes: StaveNote[],
  stemDirection?: 1 | -1,
): Tuplet[] {
  const { Tuplet } = VF;
  const groupsByTuplet = new Map<
    string,
    { groups: ChordGroup[]; vexNotes: StaveNote[] }
  >();

  groups.forEach((group, index) => {
    if (!group.tuplet) return;
    const entry = groupsByTuplet.get(group.tuplet.id) ?? {
      groups: [],
      vexNotes: [],
    };
    entry.groups.push(group);
    entry.vexNotes.push(vexNotes[index]);
    groupsByTuplet.set(group.tuplet.id, entry);
  });

  const location =
    stemDirection === -1 ? Tuplet.LOCATION_BOTTOM : Tuplet.LOCATION_TOP;
  const tuplets: Tuplet[] = [];
  for (const entry of groupsByTuplet.values()) {
    const tupletMeta = entry.groups[0]?.tuplet;
    if (!tupletMeta) continue;
    if (entry.vexNotes.length !== tupletMeta.totalNotes) continue;

    tuplets.push(
      new Tuplet(entry.vexNotes, {
        numNotes: tupletMeta.totalNotes,
        notesOccupied: tupletMeta.notesOccupied,
        location,
      }),
    );
  }

  return tuplets;
}

function drawTuplets(context: RenderContext, tuplets: Tuplet[]): void {
  tuplets.forEach((tuplet) => {
    try {
      tuplet.setContext(context).draw();
    } catch {
      // Tuplets should enhance notation, not blank an otherwise readable staff.
    }
  });
}

function drawTieBetweenGroups(
  VF: VexFlow,
  context: RenderContext,
  current: ChordGroup,
  currentNote: StaveNote | undefined,
  next: ChordGroup,
  nextNote: StaveNote | undefined,
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
  if (!currentNote || !nextNote) return;

  try {
    new VF.StaveTie({
      first_note: currentNote,
      last_note: nextNote,
      first_indices: firstIndices,
      last_indices: lastIndices,
      firstNote: currentNote,
      lastNote: nextNote,
      firstIndexes: firstIndices,
      lastIndexes: lastIndices,
    } as ConstructorParameters<typeof VF.StaveTie>[0])
      .setContext(context)
      .draw();
  } catch {
    // VexFlow requires visible endpoints; skipped ties should not blank the sheet.
  }
}

function drawCrossMeasureTies(
  VF: VexFlow,
  context: RenderContext,
  renderedMeasures: RenderedMeasure[],
): void {
  for (let i = 0; i < renderedMeasures.length - 1; i++) {
    const current = renderedMeasures[i];
    const next = renderedMeasures[i + 1];
    if (next.measureIndex !== current.measureIndex + 1) continue;

    drawCrossStaffTies(VF, context, current.treble, next.treble);
    drawCrossStaffTies(VF, context, current.bass, next.bass);
  }
}

function drawCrossStaffTies(
  VF: VexFlow,
  context: RenderContext,
  current: RenderedStaff,
  next: RenderedStaff,
): void {
  for (const currentVoice of current.voices) {
    const nextVoice = next.voices.find(
      (voice) => voice.voiceIndex === currentVoice.voiceIndex,
    );
    if (!nextVoice) continue;
    drawCrossVoiceTie(VF, context, currentVoice, nextVoice);
  }
}

function drawCrossVoiceTie(
  VF: VexFlow,
  context: RenderContext,
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

/** Small muted number above the start of a line (#332). */
function drawMeasureNumber(
  context: RenderContext,
  stave: Stave,
  label: string,
): void {
  const group = context.openGroup("measure-number") as SVGElement | undefined;
  context.save();
  try {
    context.setFont("'DM Sans Variable', sans-serif", 11, "normal");
    context.fillText(label, stave.getX(), stave.getYForLine(0) - 10);
  } finally {
    // Close the group even on failure so later measures are not nested in it.
    context.restore();
    context.closeGroup();
  }
  group?.style?.setProperty("fill", "var(--color-text-muted)");
}

function renderMeasure(
  VF: VexFlow,
  context: RenderContext,
  measure: NotationMeasure,
  x: number,
  y: number,
  width: number,
  isFirst: boolean,
  showTimeSignature: boolean,
  showBassStaff: boolean,
  isLastMeasure: boolean,
  measureNumber: string | null,
): RenderedMeasure {
  const { Stave, Voice, Formatter, StaveConnector } = VF;
  const timeSignature = `${measure.timeSignatureTop}/${measure.timeSignatureBottom}`;
  const endBarline = endBarlineType(VF, isLastMeasure);

  const treble = new Stave(x, y, width);
  if (isFirst) {
    treble
      .addClef("treble")
      .addKeySignature(keySignatureToVexKey(measure.keySignature));
  }
  if (showTimeSignature) {
    treble.addTimeSignature(timeSignature);
  }
  treble.setEndBarType(endBarline);
  treble.setContext(context).draw();
  if (measureNumber) drawMeasureNumber(context, treble, measureNumber);

  let bass: Stave | null = null;
  if (showBassStaff) {
    bass = new Stave(x, y + STAVE_HEIGHT + SYSTEM_GAP, width);
    if (isFirst) {
      bass
        .addClef("bass")
        .addKeySignature(keySignatureToVexKey(measure.keySignature));
    }
    if (showTimeSignature) {
      bass.addTimeSignature(timeSignature);
    }
    bass.setEndBarType(endBarline);
    bass.setContext(context).draw();

    if (isFirst) {
      new StaveConnector(treble, bass)
        .setType("brace")
        .setContext(context)
        .draw();
    }
    new StaveConnector(treble, bass)
      .setType(isLastMeasure ? "boldDoubleRight" : "singleRight")
      .setContext(context)
      .draw();
  }

  const trebleVoices = groupNotesIntoStaffVoices(measure.trebleNotes).map(
    (groups): RenderedVoice => {
      const vexNotes = groups.map((chord) =>
        makeStaveNote(VF, chord, "treble"),
      );
      const tuplets = makeTuplets(
        VF,
        groups,
        vexNotes,
        groups[0]?.stemDirection,
      );
      return {
        voiceIndex: groups[0]?.voiceIndex ?? 0,
        groups,
        vexNotes,
        tuplets,
        beams: createBeams(VF, groups, vexNotes, timeSignature),
      };
    },
  );

  const bassVoices = showBassStaff
    ? groupNotesIntoStaffVoices(measure.bassNotes).map(
        (groups): RenderedVoice => {
          const vexNotes = groups.map((chord) =>
            makeStaveNote(VF, chord, "bass"),
          );
          const tuplets = makeTuplets(
            VF,
            groups,
            vexNotes,
            groups[0]?.stemDirection,
          );
          return {
            voiceIndex: groups[0]?.voiceIndex ?? 0,
            groups,
            vexNotes,
            tuplets,
            beams: createBeams(VF, groups, vexNotes, timeSignature),
          };
        },
      )
    : [];

  const [numBeats, beatValue] = voiceMeter(measure);
  const trebleVexVoices = trebleVoices.map((renderedVoice) => {
    const voice = new Voice({ numBeats, beatValue });
    voice.setStrict(false);
    voice.addTickables(renderedVoice.vexNotes);
    return voice;
  });

  const bassVexVoices = bassVoices.map((renderedVoice) => {
    const voice = new Voice({ numBeats, beatValue });
    voice.setStrict(false);
    voice.addTickables(renderedVoice.vexNotes);
    return voice;
  });

  // Never format wider than the stave's note area: a clef, key and time
  // signature can take more than the 80px estimate, which pushed a short
  // first measure's last note onto its barline (#333).
  const noteArea = treble.getNoteEndX() - treble.getNoteStartX() - 10;
  const staveWidth = Math.min(width - (isFirst ? 80 : 20), noteArea);
  const formatter = new Formatter();
  if (trebleVexVoices.length > 0) {
    formatter.joinVoices(trebleVexVoices);
  }
  if (bassVexVoices.length > 0) {
    formatter.joinVoices(bassVexVoices);
  }
  formatter.format(
    [...trebleVexVoices, ...bassVexVoices],
    Math.max(staveWidth, 60),
  );

  trebleVexVoices.forEach((voice) => voice.draw(context, treble));
  if (bass) {
    bassVexVoices.forEach((voice) => voice.draw(context, bass));
  }
  trebleVoices.forEach((voice) => {
    voice.beams.forEach((beam) => beam.setContext(context).draw());
    drawTies(VF, context, voice.groups, voice.vexNotes);
    drawTuplets(context, voice.tuplets);
  });
  bassVoices.forEach((voice) => {
    voice.beams.forEach((beam) => beam.setContext(context).draw());
    drawTies(VF, context, voice.groups, voice.vexNotes);
    drawTuplets(context, voice.tuplets);
  });

  return {
    measureIndex: measure.index,
    treble: { voices: trebleVoices },
    bass: { voices: bassVoices },
  };
}

export function SheetMusicPanel({
  notationData,
  mode,
  height = 220,
  tempoMap = null,
}: SheetMusicPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgHostRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const hidden = mode === "falling";
  const cursorPosition = useMemo(() => {
    if (!notationData) return null;
    return getCursorPosition(currentTime, notationData, tempoMap ?? undefined);
  }, [currentTime, notationData, tempoMap]);
  const activeMeasureIndex = cursorPosition?.measureIndex ?? 0;

  const visibleMeasures = useMemo(() => {
    if (!notationData || notationData.measures.length === 0) return [];
    return getMeasureWindow(activeMeasureIndex, notationData.measures.length);
  }, [notationData, activeMeasureIndex]);

  const showBassStaff = notationData
    ? shouldRenderBassStaff(notationData.measures)
    : true;
  const systemHeight = showBassStaff ? SYSTEM_HEIGHT : STAVE_HEIGHT;
  const totalHeight = systemHeight + TOP_MARGIN * 2 + 16;
  // Render at a fixed logical size, then zoom so the system fits the panel.
  const heightScale = calcSheetScale(height, totalHeight);
  const logicalContainerWidth = containerWidth / heightScale;

  const renderWidth = useMemo(() => {
    if (!notationData) {
      return Math.max(
        logicalContainerWidth,
        LEFT_MARGIN * 2 + MIN_MEASURE_WIDTH * DISPLAY_MEASURE_COUNT,
      );
    }
    return calcSheetRenderWidth(
      logicalContainerWidth,
      notationData.measures,
      visibleMeasures,
      LEFT_MARGIN,
      DISPLAY_MEASURE_COUNT,
    );
  }, [logicalContainerWidth, notationData, visibleMeasures]);
  const scale = calcSheetScale(
    height,
    totalHeight,
    containerWidth,
    renderWidth,
  );
  const offsetY = Math.max(0, (height - totalHeight * scale) / 2);
  const svgWidth = renderWidth + SVG_BOUNDS_GUARD;

  const measureSlotLayout = useMemo(() => {
    if (!notationData) return [];
    return calcMeasureSlotLayout(
      notationData.measures,
      visibleMeasures,
      renderWidth,
      LEFT_MARGIN,
      DISPLAY_MEASURE_COUNT,
    );
  }, [notationData, visibleMeasures, renderWidth]);
  const activeSlotIndex =
    cursorPosition && visibleMeasures.length > 0
      ? visibleMeasures.indexOf(cursorPosition.measureIndex)
      : -1;
  const activeSlotLayout =
    activeSlotIndex >= 0 ? measureSlotLayout[activeSlotIndex] : null;
  const activeMeasure =
    activeSlotIndex >= 0 && cursorPosition && notationData
      ? notationData.measures[cursorPosition.measureIndex]
      : null;
  // A pickup shows the song's meter but lasts only its own beats (#333).
  const beatsPerMeasure = Math.max(
    activeMeasure ? voiceMeter(activeMeasure)[0] : 4,
    1,
  );
  const beatRatio =
    cursorPosition && activeSlotIndex >= 0
      ? Math.max(0, Math.min(0.995, cursorPosition.beat / beatsPerMeasure))
      : 0;
  const activeMeasureLeft = activeSlotLayout?.x ?? 0;
  const activeMeasureWidth = activeSlotLayout?.width ?? 0;
  const cursorLeft = activeMeasureLeft + activeMeasureWidth * beatRatio;
  const panX = calcSheetPanX(
    cursorLeft * scale,
    renderWidth * scale,
    containerWidth,
  );

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
      measureSlotLayout.length === 0
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
        renderer.resize(svgWidth, totalHeight);
        const context = renderer.getContext();
        const renderedMeasures: RenderedMeasure[] = [];

        for (let slot = 0; slot < DISPLAY_MEASURE_COUNT; slot++) {
          const layout = measureSlotLayout[slot];
          if (!layout || layout.width <= 0) continue;

          const measureIndex = layout.measureIndex;
          const x = layout.x;
          const width = layout.width;
          const y = TOP_MARGIN;
          const isFirst = slot === 0;

          // Slots past the song's last measure are not laid out (#312).
          if (measureIndex === undefined) continue;

          const measure = notationData.measures[measureIndex];
          const previousMeasure = notationData.measures[measureIndex - 1];
          const meterChanged =
            previousMeasure !== undefined &&
            (previousMeasure.timeSignatureTop !== measure.timeSignatureTop ||
              previousMeasure.timeSignatureBottom !==
                measure.timeSignatureBottom);

          try {
            renderedMeasures.push(
              renderMeasure(
                VF,
                context,
                measure,
                x,
                y,
                width,
                isFirst,
                isFirst || meterChanged,
                showBassStaff,
                measureIndex === notationData.measures.length - 1,
                measureNumberLabel(measure.number ?? measure.index + 1, slot),
              ),
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
    renderWidth,
    svgWidth,
    totalHeight,
    visibleMeasures,
    measureSlotLayout,
    showBassStaff,
  ]);

  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      className="relative w-full min-w-0 overflow-hidden"
      style={{
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
        className="absolute left-0 pointer-events-none"
        style={{
          top: offsetY,
          width: renderWidth,
          height: totalHeight,
          transform: `translateX(${-panX}px) scale(${scale})`,
          transformOrigin: "0 0",
          transition: "transform 200ms ease-out",
        }}
        data-testid="sheet-music-scaled-system"
      >
        <div
          ref={svgHostRef}
          className="h-full w-full"
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
                height: systemHeight,
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
                height: systemHeight - 8,
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
      </div>

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
