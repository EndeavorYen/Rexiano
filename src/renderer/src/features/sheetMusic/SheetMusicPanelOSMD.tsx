import React, { useRef, useEffect, useMemo } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { DisplayMode } from "./types";
import { convertToMusicXML } from "@renderer/engines/notation/MidiToMusicXML";

interface SheetMusicPanelOSMDProps {
  song: ParsedSong | null;
  mode: DisplayMode;
}

export function SheetMusicPanelOSMD({
  song,
  mode,
}: SheetMusicPanelOSMDProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const osmdRef = useRef<any>(null);

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

  // Re-run when musicXml changes OR when mode transitions away from "falling"
  // (since the container div is conditionally rendered based on mode).
  useEffect(() => {
    if (mode === "falling") return;
    if (!containerRef.current || !musicXml) return;

    const container = containerRef.current;
    let cancelled = false;

    import("opensheetmusicdisplay")
      .then(({ OpenSheetMusicDisplay }) => {
        if (cancelled || !containerRef.current) return;

        if (!osmdRef.current) {
          osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: false,
            drawTitle: false,
            drawComposer: false,
            drawPartNames: false,
          });
        }

        return osmdRef.current.load(musicXml).then(() => {
          if (!cancelled) {
            osmdRef.current?.render();
          }
        });
      })
      .catch((err: unknown) => {
        console.error("[SheetMusicPanelOSMD] Failed to load/render:", err);
      });

    return () => {
      cancelled = true;
      // Clear the OSMD instance so that if the container div is recreated
      // (e.g. mode toggles away and back), we construct a fresh instance
      // bound to the new DOM node instead of rendering into a detached one.
      if (osmdRef.current) {
        osmdRef.current.clear();
        osmdRef.current = null;
      }
      // Remove any residual SVG content synchronously so stale sheet music
      // is not visible while the next async import resolves.
      container.textContent = "";
    };
  }, [musicXml, mode]);

  // Re-render OSMD on container resize (since autoResize is disabled to
  // avoid leaking internal resize observers across OSMD instance lifecycles).
  useEffect(() => {
    if (mode === "falling" || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      if (osmdRef.current) {
        osmdRef.current.render();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Always render the container div so containerRef stays attached across
  // mode transitions. Returning null would detach the ref, causing the
  // useEffect to silently skip OSMD init when switching back from "falling".
  return (
    <div
      ref={containerRef}
      className="sheet-music-osmd w-full overflow-y-auto"
      style={{
        minHeight: mode === "falling" ? 0 : 200,
        padding: mode === "falling" ? 0 : "8px 0",
        display: mode === "falling" ? "none" : undefined,
      }}
    />
  );
}
