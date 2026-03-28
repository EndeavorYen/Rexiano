import React, { useRef, useEffect, useMemo } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { DisplayMode } from "./types";
import { convertToMusicXML } from "@renderer/engines/notation/MidiToMusicXML";
import { usePlaybackStore } from "../../stores/usePlaybackStore";
import {
  highlightNotesUnderCursor,
  clearHighlights,
} from "./osmdCursorHighlight";

interface SheetMusicPanelOSMDProps {
  song: ParsedSong | null;
  mode: DisplayMode;
}

/**
 * Convert OSMD cursor iterator's beat-fraction timestamp to seconds.
 * Uses song.tempos BPM (from MIDI) — NOT OSMD's SourceMeasures.TempoInBPM
 * which always defaults to 120 regardless of actual tempo.
 */
export function cursorTimeToSeconds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  osmd: any,
  bpm: number,
): number {
  const it = osmd?.cursor?.Iterator;
  if (!it) return 0;
  const realValue = it.currentTimeStamp?.RealValue ?? 0;
  // RealValue is relative to a whole note (1.0 = 4 quarter beats)
  return realValue * 4 * (60 / bpm);
}

export function SheetMusicPanelOSMD({
  song,
  mode,
}: SheetMusicPanelOSMDProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osmdRef = useRef<any>(null);
  const loadedRef = useRef(false);

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

  // Effect 1: Load MusicXML + render full score + enable cursor
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
            followCursor: true,
          });
          osmdRef.current.EngravingRules.StretchLastSystemLine = false;
        }

        // No drawFromMeasureNumber / drawUpToMeasureNumber — render full score
        return osmdRef.current.load(musicXml).then(() => {
          if (cancelled) return;
          osmdRef.current.render();
          loadedRef.current = true;

          // Show and reset cursor
          const cursor = osmdRef.current.cursor;
          if (cursor) {
            cursor.reset();
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
    };
  }, [musicXml, mode]);

  // Re-render on container resize
  useEffect(() => {
    if (mode === "falling" || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      if (osmdRef.current && loadedRef.current) {
        osmdRef.current.render();
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

  // Effect 2: Drive cursor forward during playback.
  // Reads currentTime from the store (written every frame by tickerLoop).
  // Compares against the cursor's next step time — if currentTime has
  // passed it, advance cursor.next() and add CSS glow.
  // followCursor: true handles scrolling automatically.
  useEffect(() => {
    if (mode === "falling" || !containerRef.current || !song) return;
    const container = containerRef.current;
    let wasPlaying = false;

    const bpm = song.tempos[0]?.bpm ?? 120;

    let lastCursorTime = -1;
    let lastHighlightTime = -1;

    const intervalId = setInterval(() => {
      const osmd = osmdRef.current;
      if (!osmd || !loadedRef.current) return;

      const { isPlaying, currentTime } = usePlaybackStore.getState();
      const cursor = osmd.cursor;
      if (!cursor) return;

      if (!isPlaying) {
        if (wasPlaying) {
          clearHighlights(container);
          wasPlaying = false;
        }
        return;
      }

      if (!wasPlaying) {
        cursor.reset();
        lastCursorTime = 0;
        lastHighlightTime = -1;
        wasPlaying = true;
      }

      if (cursor.Iterator?.EndReached) return;

      // Detect seek backward: currentTime jumped behind cursor position
      if (currentTime < lastCursorTime - 0.1) {
        cursor.reset();
        lastCursorTime = 0;
        lastHighlightTime = -1;
      }

      // Advance cursor: peek at the NEXT step's time. If currentTime
      // has passed it, move forward. This keeps the cursor ON the step
      // whose notes are currently sounding (not one step ahead).
      for (let i = 0; i < 200; i++) {
        if (cursor.Iterator?.EndReached) break;
        // Peek: what time is the next step?
        cursor.next();
        const nextStepTime = cursorTimeToSeconds(osmd, bpm);
        if (nextStepTime > currentTime) {
          // Went too far — step back to the current position
          cursor.previous();
          break;
        }
        lastCursorTime = nextStepTime;
      }

      // Always highlight the current cursor position (handles first note too)
      const curTime = cursorTimeToSeconds(osmd, bpm);
      if (currentTime >= curTime && curTime !== lastHighlightTime) {
        clearHighlights(container);
        highlightNotesUnderCursor(osmd);
        lastHighlightTime = curTime;
      }
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
