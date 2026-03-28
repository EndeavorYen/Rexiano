import React, { useRef, useEffect, useMemo } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { DisplayMode } from "./types";
import { convertToMusicXML } from "@renderer/engines/notation/MidiToMusicXML";
import { usePlaybackStore } from "../../stores/usePlaybackStore";
import { HighlightManager, buildCursorMaps } from "./osmdCursorHighlight";

interface SheetMusicPanelOSMDProps {
  song: ParsedSong | null;
  mode: DisplayMode;
  /** Active noteKeys from tickerLoop — "trackIdx:midi:time" format */
  activeNoteKeys?: Set<string>;
}

export interface StepTiming {
  time: number;
}

const EMPTY_KEY_SET = new Set<string>();

export function SheetMusicPanelOSMD({
  song,
  mode,
  activeNoteKeys = EMPTY_KEY_SET,
}: SheetMusicPanelOSMDProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osmdRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const stepTimesRef = useRef<StepTiming[]>([]);
  const noteKeyMapRef = useRef<Map<string, Element[]>>(new Map());
  const hlRef = useRef(new HighlightManager());

  const musicXml = useMemo(() => {
    if (!song) return null;
    const flattened = song.tracks.flatMap((track, idx) =>
      track.notes.map((note) => ({ note, trackIndex: idx })),
    );
    return convertToMusicXML(
      flattened.map((x) => x.note),
      song.tempos.length > 0 ? song.tempos : [{ time: 0, bpm: 120 }],
      480,
      song.timeSignatures[0]?.numerator ?? 4,
      song.timeSignatures[0]?.denominator ?? 4,
      song.keySignatures?.[0]?.key ?? 0,
      0,
      song.tracks.length,
      song.expressions,
      song.timeSignatures,
      flattened.map((x) => x.trackIndex),
    );
  }, [song]);

  /** Build both stepTimes and noteKeyMap in a single cursor pass. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rebuildMaps = (osmd: any, s: ParsedSong): void => {
    const { stepTimes, noteKeyMap } = buildCursorMaps(osmd, s);
    stepTimesRef.current = stepTimes;
    noteKeyMapRef.current = noteKeyMap;
  };

  // Effect 1: Load MusicXML + render full score + enable cursor + build maps
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
            drawMetronomeMarks: false,
            autoBeam: true,
            followCursor: true,
          });
          osmdRef.current.EngravingRules.StretchLastSystemLine = false;
        }

        return osmdRef.current.load(musicXml).then(() => {
          if (cancelled) return;
          osmdRef.current.render();
          loadedRef.current = true;

          // Single cursor pass builds both stepTimes and noteKeyMap
          if (song) {
            rebuildMaps(osmdRef.current, song);
          }
          const cursor = osmdRef.current.cursor;
          if (cursor) {
            cursor.show();
          }
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
      noteKeyMapRef.current = new Map();
    };
  }, [musicXml, mode]);

  // Re-render on container resize
  useEffect(() => {
    if (mode === "falling" || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      if (osmdRef.current && loadedRef.current) {
        osmdRef.current.render();
        hlRef.current.clear();
        if (song) {
          rebuildMaps(osmdRef.current, song);
        }
        const cursor = osmdRef.current.cursor;
        if (cursor) {
          cursor.reset();
          cursor.show();
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Effect 2: Drive cursor forward during playback (green bar position only).
  useEffect(() => {
    if (mode === "falling" || !containerRef.current || !song) return;
    let wasPlaying = false;
    let cursorPos = 0;

    const intervalId = setInterval(() => {
      const osmd = osmdRef.current;
      if (!osmd || !loadedRef.current) return;
      const steps = stepTimesRef.current;
      if (steps.length === 0) return;

      const { isPlaying, currentTime } = usePlaybackStore.getState();
      const cursor = osmd.cursor;
      if (!cursor) return;

      if (!isPlaying) {
        wasPlaying = false;
        return;
      }

      if (!wasPlaying) {
        cursor.reset();
        cursorPos = 0;
        wasPlaying = true;
      }

      // Seek backward
      if (cursorPos > 0 && currentTime < steps[cursorPos].time - 0.1) {
        cursor.reset();
        cursorPos = 0;
      }

      // Advance cursor while the NEXT step's time has been reached
      while (
        cursorPos + 1 < steps.length &&
        steps[cursorPos + 1].time <= currentTime
      ) {
        cursor.next();
        cursorPos++;
      }
    }, 50);

    return () => {
      clearInterval(intervalId);
    };
  }, [song, mode]);

  // Effect 3: Highlight notes from activeNoteKeys via noteKey→SVG map.
  useEffect(() => {
    if (mode === "falling" || !loadedRef.current) return;
    const hl = hlRef.current;
    const map = noteKeyMapRef.current;

    if (activeNoteKeys.size === 0) {
      hl.clear();
      return;
    }

    hl.highlightByNoteKeys(activeNoteKeys, map);

    if (containerRef.current) {
      hl.scrollToActive(containerRef.current);
    }
  }, [activeNoteKeys, mode]);

  return (
    <div
      ref={containerRef}
      data-testid="sheet-music-panel"
      className="sheet-music-osmd w-full"
      style={{
        ...(mode === "split"
          ? { height: "100%", minHeight: 0, overflowY: "auto" }
          : {
              minHeight: mode === "sheet" ? 200 : 0,
              maxHeight: mode === "sheet" ? "calc(100vh - 320px)" : undefined,
              overflowY: mode === "sheet" ? "auto" : undefined,
            }),
        padding: mode === "falling" ? 0 : "8px 0",
        display: mode === "falling" ? "none" : undefined,
      }}
    />
  );
}
