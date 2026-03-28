import React, {
  useRef,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { DisplayMode } from "./types";
import { convertToMusicXML } from "@renderer/engines/notation/MidiToMusicXML";
import { usePlaybackStore } from "../../stores/usePlaybackStore";
import { getMeasureWindow } from "./CursorSync";
import {
  buildCursorSteps,
  findStepAtTime,
  highlightStep,
  clearHighlights,
  type CursorStep,
} from "./osmdCursorHighlight";

/** Default number of measures to display per page (one system line). */
const MEASURES_PER_PAGE = 4;

interface SheetMusicPanelOSMDProps {
  song: ParsedSong | null;
  mode: DisplayMode;
}

/**
 * Estimate the current 0-based measure index from playback time.
 */
function estimateMeasureIndex(song: ParsedSong, time: number): number {
  const bpm = song.tempos[0]?.bpm ?? 120;
  const ts = song.timeSignatures[0];
  const num = ts?.numerator ?? 4;
  const den = ts?.denominator ?? 4;
  const secPerMeasure = (60 / bpm) * num * (4 / den);
  if (secPerMeasure <= 0) return 0;
  return Math.floor(Math.max(0, time) / secPerMeasure);
}

export function SheetMusicPanelOSMD({
  song,
  mode,
}: SheetMusicPanelOSMDProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osmdRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const [totalMeasures, setTotalMeasures] = useState(0);

  // Cursor step list for highlight engine
  const cursorStepsRef = useRef<CursorStep[]>([]);

  const currentMeasure = usePlaybackStore(
    useCallback(
      (s: { currentTime: number }) =>
        song ? estimateMeasureIndex(song, s.currentTime) : 0,
      [song],
    ),
  );

  const measureWindow = useMemo(
    () =>
      totalMeasures > 0
        ? getMeasureWindow(currentMeasure, totalMeasures, MEASURES_PER_PAGE)
        : [],
    [currentMeasure, totalMeasures],
  );
  const windowKey = measureWindow.join(",");

  const musicXml = useMemo(() => {
    if (!song) return null;

    const flattened = song.tracks.flatMap((track, idx) =>
      track.notes.map((note) => ({ note, trackIndex: idx })),
    );
    const allNotes = flattened.map((x) => x.note);
    const noteTrackIndices = flattened.map((x) => x.trackIndex);
    const tempos =
      song.tempos.length > 0 ? song.tempos : [{ time: 0, bpm: 120 }];
    const primaryTs = song.timeSignatures[0];
    const timeSigTop = primaryTs?.numerator ?? 4;
    const timeSigBottom = primaryTs?.denominator ?? 4;
    const keySig = song.keySignatures?.[0]?.key ?? 0;

    return convertToMusicXML(
      allNotes,
      tempos,
      480,
      timeSigTop,
      timeSigBottom,
      keySig,
      0,
      song.tracks.length,
      song.expressions,
      song.timeSignatures,
      noteTrackIndices,
    );
  }, [song]);

  // Effect 1: Load MusicXML into OSMD
  useEffect(() => {
    if (mode === "falling") return;
    if (!containerRef.current || !musicXml) return;

    const container = containerRef.current;
    let cancelled = false;
    loadedRef.current = false;

    import("opensheetmusicdisplay")
      .then(({ OpenSheetMusicDisplay }) => {
        if (cancelled || !containerRef.current) return;

        if (!osmdRef.current) {
          osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: false,
            drawTitle: false,
            drawComposer: false,
            drawPartNames: false,
            autoBeam: true,
          });
          osmdRef.current.EngravingRules.StretchLastSystemLine = false;
        }

        return osmdRef.current.load(musicXml).then(() => {
          if (cancelled) return;
          loadedRef.current = true;
          const total = osmdRef.current?.sheet?.SourceMeasures?.length ?? 0;
          setTotalMeasures(total);
        });
      })
      .catch((err: unknown) => {
        console.error("[SheetMusicPanelOSMD] Failed to load/render:", err);
      });

    return () => {
      cancelled = true;
      if (osmdRef.current) {
        osmdRef.current.clear();
        osmdRef.current = null;
      }
      container.textContent = "";
      loadedRef.current = false;
      cursorStepsRef.current = [];
      setTotalMeasures(0);
    };
  }, [musicXml, mode]);

  // Effect 2: Render with measure range, then build cursor steps.
  useEffect(() => {
    if (!loadedRef.current || !osmdRef.current || mode === "falling") return;

    if (measureWindow.length > 0) {
      osmdRef.current.setOptions({
        drawFromMeasureNumber: measureWindow[0] + 1,
        drawUpToMeasureNumber: measureWindow[measureWindow.length - 1] + 1,
      });
    }
    osmdRef.current.render();

    // Build cursor steps with time mapping from ParsedNote.time
    cursorStepsRef.current = buildCursorSteps(osmdRef.current, song);

    // Hide built-in cursor element (we use CSS highlights)
    const cursor = osmdRef.current.cursor;
    if (cursor?.cursorElement) {
      cursor.cursorElement.style.display = "none";
    }
  }, [windowKey, totalMeasures, mode, song]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render on container resize
  useEffect(() => {
    if (mode === "falling" || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      if (osmdRef.current && loadedRef.current) {
        osmdRef.current.render();
        cursorStepsRef.current = buildCursorSteps(osmdRef.current, song);
        if (osmdRef.current.cursor?.cursorElement) {
          osmdRef.current.cursor.cursorElement.style.display = "none";
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode, song]);

  // Effect 3: Time-driven note highlighting.
  //
  // Reads currentTime from the playback store (written every frame by
  // tickerLoop — same effectiveTime that drives falling notes + keyboard).
  // Binary-searches cursorSteps to find the right step, then highlights
  // its cached SVG elements.
  //
  // Uses setInterval because Electron throttles rAF when PixiJS is the
  // primary renderer.
  useEffect(() => {
    if (mode === "falling" || !containerRef.current || !song) return;
    const container = containerRef.current;
    let prevStepIdx = -1;

    const intervalId = setInterval(() => {
      const { isPlaying, currentTime } = usePlaybackStore.getState();
      const steps = cursorStepsRef.current;
      if (steps.length === 0) return;

      if (!isPlaying) {
        if (prevStepIdx !== -1) {
          clearHighlights(container);
          prevStepIdx = -1;
        }
        return;
      }

      const step = findStepAtTime(steps, currentTime);
      if (!step) {
        if (prevStepIdx !== -1) {
          clearHighlights(container);
          prevStepIdx = -1;
        }
        return;
      }

      // Only update DOM when the highlighted step changes
      const idx = steps.indexOf(step);
      if (idx === prevStepIdx) return;
      const prevStep = prevStepIdx >= 0 ? steps[prevStepIdx] : null;
      prevStepIdx = idx;

      highlightStep(step, prevStep);
    }, 50);

    return () => {
      clearInterval(intervalId);
      if (containerRef.current) clearHighlights(containerRef.current);
    };
  }, [song, mode]);

  return (
    <div
      ref={containerRef}
      data-testid="sheet-music-panel"
      className="sheet-music-osmd w-full"
      style={{
        ...(mode === "split"
          ? { height: "100%", minHeight: 0 }
          : { minHeight: mode === "sheet" ? 200 : 0 }),
        padding: mode === "falling" ? 0 : "8px 0",
        display: mode === "falling" ? "none" : undefined,
      }}
    />
  );
}
