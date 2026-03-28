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
  highlightActiveNotes,
  clearHighlights,
  estimateBeatPosition,
} from "./osmdNoteHighlight";

/** Default number of measures to display per page (one system line). */
const MEASURES_PER_PAGE = 4;

interface SheetMusicPanelOSMDProps {
  song: ParsedSong | null;
  mode: DisplayMode;
}

/**
 * Estimate the current 0-based measure index from playback time.
 * Uses the first tempo and time signature — sufficient for page-flip accuracy.
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

  // Subscribe to playback, but only re-render when the measure index changes
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

  // Effect 1: Load MusicXML into OSMD (no render — handled by Effect 2)
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
          // Don't stretch partial lines — prevents over-wide measure spacing
          osmdRef.current.EngravingRules.StretchLastSystemLine = false;
        }

        return osmdRef.current.load(musicXml).then(() => {
          if (cancelled) return;
          loadedRef.current = true;
          const total = osmdRef.current?.sheet?.SourceMeasures?.length ?? 0;
          setTotalMeasures(total);
          // Effect 2 will handle the actual render with measure range
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
      setTotalMeasures(0);
    };
  }, [musicXml, mode]);

  // Effect 2: Render with the current measure range (page flips only)
  useEffect(() => {
    if (!loadedRef.current || !osmdRef.current || mode === "falling") return;

    if (measureWindow.length > 0) {
      osmdRef.current.setOptions({
        drawFromMeasureNumber: measureWindow[0] + 1,
        drawUpToMeasureNumber: measureWindow[measureWindow.length - 1] + 1,
      });
    }
    osmdRef.current.render();
  }, [windowKey, totalMeasures, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render OSMD on container resize (since autoResize is disabled to
  // avoid leaking internal resize observers across OSMD instance lifecycles).
  useEffect(() => {
    if (mode === "falling" || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      if (osmdRef.current && loadedRef.current) {
        osmdRef.current.render();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Effect 3: Highlight active notes during playback.
  // Uses requestAnimationFrame instead of store subscription because
  // currentTime is read via getState() by the PixiJS ticker — the store
  // does not fire subscription callbacks on every frame update.
  useEffect(() => {
    if (mode === "falling" || !containerRef.current || !song) return;

    const container = containerRef.current;
    let rafId = 0;
    let prevBeatKey = "";

    const bpm = song.tempos[0]?.bpm ?? 120;
    const ts = song.timeSignatures[0];
    const num = ts?.numerator ?? 4;
    const den = ts?.denominator ?? 4;

    function tick(): void {
      rafId = requestAnimationFrame(tick);

      const { isPlaying, currentTime } = usePlaybackStore.getState();
      if (!osmdRef.current || !loadedRef.current) return;

      if (!isPlaying) {
        if (prevBeatKey !== "") {
          clearHighlights(container);
          prevBeatKey = "";
        }
        return;
      }

      const { measureIndex, beat } = estimateBeatPosition(
        currentTime,
        bpm,
        num,
        den,
      );

      // Only update DOM when the beat position actually changes (throttle)
      const beatKey = `${measureIndex}:${Math.floor(beat * 2)}`;
      if (beatKey === prevBeatKey) return;
      prevBeatKey = beatKey;

      if (measureWindow.length > 0) {
        const localIndex = measureIndex - measureWindow[0];
        if (localIndex >= 0 && localIndex < measureWindow.length) {
          highlightActiveNotes(osmdRef.current, localIndex, beat, container);
        } else {
          clearHighlights(container);
        }
      }
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clearHighlights(container);
    };
  }, [song, mode, measureWindow]);

  // Always render the container div so containerRef stays attached across
  // mode transitions. Returning null would detach the ref, causing the
  // useEffect to silently skip OSMD init when switching back from "falling".
  return (
    <div
      ref={containerRef}
      data-testid="sheet-music-panel"
      className="sheet-music-osmd w-full"
      style={{
        // In split mode, fill the flex-constrained parent exactly.
        // In sheet mode (full height), use 200px minimum.
        ...(mode === "split"
          ? { height: "100%", minHeight: 0 }
          : { minHeight: mode === "sheet" ? 200 : 0 }),
        padding: mode === "falling" ? 0 : "8px 0",
        display: mode === "falling" ? "none" : undefined,
      }}
    />
  );
}
