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
}: SheetMusicPanelOSMDProps): React.ReactElement | null {
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

    let cancelled = false;

    import("opensheetmusicdisplay")
      .then(({ OpenSheetMusicDisplay }) => {
        if (cancelled || !containerRef.current) return;

        if (!osmdRef.current) {
          osmdRef.current = new OpenSheetMusicDisplay(containerRef.current, {
            autoResize: true,
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
    };
  }, [musicXml, mode]);

  // NOTE: unmount cleanup is handled by the main useEffect's cleanup above.
  // No separate unmount effect needed — when the component unmounts, React
  // runs the cleanup of the [musicXml, mode] effect, which clears osmdRef.

  if (mode === "falling") return null;

  return (
    <div
      ref={containerRef}
      className="sheet-music-osmd w-full overflow-y-auto"
      style={{ minHeight: 200, padding: "8px 0" }}
    />
  );
}
