import React, { useRef, useEffect, useMemo } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { DisplayMode } from "./types";
import { convertToMusicXML } from "@renderer/engines/notation/MidiToMusicXML";
import { usePlaybackStore } from "../../stores/usePlaybackStore";
import { HighlightManager } from "./osmdCursorHighlight";

interface SheetMusicPanelOSMDProps {
  song: ParsedSong | null;
  mode: DisplayMode;
}

export interface StepTiming {
  time: number;
}

/**
 * Build timing info for each OSMD cursor step from ParsedNote.time.
 * Respects tempo changes. Must be called after osmd.render().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildStepTimes(osmd: any, song: ParsedSong): StepTiming[] {
  const cursor = osmd?.cursor;
  if (!cursor) return [];

  const notesByMidi = new Map<number, number[]>();
  for (const track of song.tracks) {
    for (const note of track.notes) {
      let list = notesByMidi.get(note.midi);
      if (!list) {
        list = [];
        notesByMidi.set(note.midi, list);
      }
      list.push(note.time);
    }
  }
  for (const list of notesByMidi.values()) {
    list.sort((a, b) => a - b);
  }

  cursor.reset();
  const it = cursor.Iterator;
  if (!it) return [];

  const steps: StepTiming[] = [];
  let lastTime = -1;

  while (!it.EndReached) {
    const voices = it.CurrentVoiceEntries || [];
    let bestTime = Infinity;

    for (const ve of voices) {
      for (const note of ve.Notes) {
        if (note.isRest()) continue;
        const midi = note.halfTone + 12;
        const list = notesByMidi.get(midi);
        if (!list) continue;
        let lo = 0;
        let hi = list.length - 1;
        let found = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >>> 1;
          if (list[mid] > lastTime + 0.001) {
            found = mid;
            hi = mid - 1;
          } else {
            lo = mid + 1;
          }
        }
        if (found >= 0 && list[found] < bestTime) {
          bestTime = list[found];
        }
      }
    }

    if (bestTime < Infinity) {
      steps.push({ time: bestTime });
      lastTime = bestTime;
    } else {
      steps.push({ time: lastTime + 0.01 });
    }

    cursor.next();
  }

  cursor.reset();
  return steps;
}

export function SheetMusicPanelOSMD({
  song,
  mode,
}: SheetMusicPanelOSMDProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osmdRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const stepTimesRef = useRef<StepTiming[]>([]);
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

          // Build step times and show cursor
          if (song) {
            stepTimesRef.current = buildStepTimes(osmdRef.current, song);
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
  // Each step's highlights replace the previous step's (no duration tracking).
  useEffect(() => {
    if (mode === "falling" || !containerRef.current || !song) return;
    const hl = hlRef.current;
    let wasPlaying = false;
    let cursorPos = 0;
    let lastHighlightedPos = -1;

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
        hl.clear();
        cursorPos = 0;
        lastHighlightedPos = -1;
        wasPlaying = true;
      }

      // Seek backward
      if (cursorPos > 0 && currentTime < steps[cursorPos].time - 0.1) {
        cursor.reset();
        hl.clear();
        cursorPos = 0;
        lastHighlightedPos = -1;
      }

      // Advance cursor while the NEXT step's time has been reached
      while (
        cursorPos + 1 < steps.length &&
        steps[cursorPos + 1].time <= currentTime
      ) {
        cursor.next();
        cursorPos++;
      }

      // Highlight the current step (replaces previous)
      if (
        currentTime >= steps[cursorPos].time &&
        cursorPos !== lastHighlightedPos
      ) {
        hl.highlight(osmd);
        lastHighlightedPos = cursorPos;
      }
    }, 50);

    return () => {
      clearInterval(intervalId);
      hl.clear();
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
