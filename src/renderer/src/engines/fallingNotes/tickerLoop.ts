import type { NoteRenderer } from "./NoteRenderer";
import type { Viewport } from "./ViewportManager";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { getPracticeEngines } from "@renderer/engines/practice/practiceManager";
import { getMetronome } from "@renderer/engines/metronome/metronomeManager";

/** Cap frame delta to prevent large time jumps (e.g. after tab backgrounding) */
const MAX_DELTA_SECONDS = 0.1;

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Create the per-frame ticker callback for the falling notes render loop.
 *
 * Reads song/playback/practice state from Zustand stores, advances time when playing,
 * applies practice mode logic (wait gate, speed, loop), updates the NoteRenderer,
 * and notifies about active notes only when they change.
 */
export function createTickerUpdate(
  noteRenderer: NoteRenderer,
  getScreenSize: () => { width: number; height: number },
  onActiveNotesChangeRef: {
    current: ((notes: Set<number>) => void) | undefined;
  },
  getAudioCurrentTime?: () => number | null,
) {
  let prevActiveNotes = new Set<number>();

  return (time: { deltaMS: number }) => {
    const songState = useSongStore.getState();
    const playState = usePlaybackStore.getState();
    if (!songState.song) return;

    // Read practice state only when playing (avoids getState + destructure at idle)
    const engines = getPracticeEngines();
    const { waitMode, speedController, loopController } = engines;

    // Compute effective pps with speed multiplier
    const effectivePps = speedController
      ? speedController.effectivePixelsPerSecond(playState.pixelsPerSecond)
      : playState.pixelsPerSecond;

    let effectiveTime = playState.currentTime;

    if (playState.isPlaying) {
      // ── R2-010: Count-in freeze — don't advance time during count-in ──
      // R3-002 safety: if isCountingIn but no metronome is running, auto-clear
      if (playState.isCountingIn) {
        const metronome = getMetronome();
        if (metronome && !metronome.isRunning) {
          // Safety check: metronome stopped but isCountingIn stuck — clear it
          usePlaybackStore.getState().setCountingIn(false);
        } else {
          const screen = getScreenSize();
          const vp: Viewport = {
            width: screen.width,
            height: screen.height,
            pps: effectivePps,
            currentTime: effectiveTime,
          };
          noteRenderer.update(songState.song, vp);
          return;
        }
      }

      // ── WaitMode gate: if waiting, freeze time ──
      if (usePracticeStore.getState().mode === "wait" && waitMode) {
        // R2-007: Read latencyCompensation from store and pass as parameter
        const latencyMs = useSettingsStore.getState().latencyCompensation;
        const shouldContinue = waitMode.tick(effectiveTime, latencyMs);
        if (!shouldContinue) {
          // Don't advance time — waiting for user input
          // Still update renderer so notes stay visible
          const screen = getScreenSize();
          const vp: Viewport = {
            width: screen.width,
            height: screen.height,
            pps: effectivePps,
            currentTime: effectiveTime,
          };
          noteRenderer.update(songState.song, vp);
          return;
        }
      }

      const audioTime = getAudioCurrentTime?.();
      if (audioTime != null) {
        effectiveTime = Math.min(audioTime, songState.song.duration);
      } else {
        const dt = Math.min(time.deltaMS / 1000, MAX_DELTA_SECONDS);
        const speedMul = speedController?.multiplier ?? 1.0;
        effectiveTime = Math.min(
          effectiveTime + dt * speedMul,
          songState.song.duration,
        );
      }

      // ── Loop check: auto-seek at B point (before writing to store) ──
      if (
        loopController?.isActive &&
        loopController.shouldLoop(effectiveTime)
      ) {
        effectiveTime = loopController.getLoopStart();
      }

      // Single setCurrentTime per frame (avoids double-fire to subscribers)
      playState.setCurrentTime(effectiveTime);

      if (effectiveTime >= songState.song.duration) {
        playState.setPlaying(false);
      }
    }

    const screen = getScreenSize();
    const vp: Viewport = {
      width: screen.width,
      height: screen.height,
      pps: effectivePps,
      currentTime: effectiveTime,
    };

    noteRenderer.update(songState.song, vp);

    // Only notify React when active notes actually change
    if (onActiveNotesChangeRef.current) {
      const next = noteRenderer.activeNotes;
      if (!setsEqual(prevActiveNotes, next)) {
        const snapshot = new Set(next);
        prevActiveNotes = snapshot;
        onActiveNotesChangeRef.current(snapshot);
      }
    }
  };
}
