import type { NoteRenderer } from "./NoteRenderer";
import type { Viewport } from "./ViewportManager";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { getPracticeEngines } from "@renderer/engines/practice/practiceManager";
import type { RenderDiagnosticsFrame } from "./renderDiagnostics";

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function nowMs(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * Create the per-frame ticker callback for the falling notes render loop.
 *
 * This draws; it does not advance time. Playback position is owned by
 * `TransportClock` so that the clock survives this canvas being unmounted —
 * sheet-only mode has no falling notes, and wait mode must still work there.
 * Each frame reads the committed time from the playback store and renders it.
 */
export function createTickerUpdate(
  noteRenderer: NoteRenderer,
  getScreenSize: () => { width: number; height: number },
  onActiveNotesChangeRef: {
    current: ((notes: Set<number>) => void) | undefined;
  },
  onDiagnostics?: (frame: RenderDiagnosticsFrame) => void,
) {
  let prevActiveNotes = new Set<number>();

  return (time: { deltaMS: number }) => {
    const frameStart = onDiagnostics ? nowMs() : 0;
    const song = useSongStore.getState().song;
    if (!song) return;

    const playState = usePlaybackStore.getState();
    const { speedController } = getPracticeEngines();

    // Speed changes the fall rate, so it belongs to the viewport, not the clock.
    const effectivePps = speedController
      ? speedController.effectivePixelsPerSecond(playState.pixelsPerSecond)
      : playState.pixelsPerSecond;

    const screen = getScreenSize();
    const vp: Viewport = {
      width: screen.width,
      height: screen.height,
      pps: effectivePps,
      currentTime: playState.currentTime,
    };

    noteRenderer.update(song, vp);

    // Only notify React when active notes actually change
    if (onActiveNotesChangeRef.current) {
      const next = noteRenderer.activeNotes;
      if (!setsEqual(prevActiveNotes, next)) {
        const snapshot = new Set(next);
        prevActiveNotes = snapshot;
        onActiveNotesChangeRef.current(snapshot);
      }
    }

    if (onDiagnostics) {
      onDiagnostics({
        ...noteRenderer.getDiagnostics(),
        frameDurationMs: nowMs() - frameStart,
        tickerDeltaMs: time.deltaMS,
        viewportWidth: vp.width,
        viewportHeight: vp.height,
        currentTime: playState.currentTime,
        songNoteCount: song.noteCount,
      });
    }
  };
}
