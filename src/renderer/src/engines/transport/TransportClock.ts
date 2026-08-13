/**
 * TransportClock — owns playback time advancement.
 *
 * Time used to be advanced inside the PixiJS ticker that belongs to the falling
 * notes canvas, which made the clock a side effect of rendering: sheet-only mode
 * had to keep a hidden canvas mounted or playback would freeze, and wait mode
 * silently depended on PixiJS being alive. The clock is now a standalone engine,
 * so any view — falling notes, sheet music, both, or neither — can come and go
 * without stopping playback.
 *
 * The audio clock stays the master: `AudioContext.currentTime` drives song time
 * whenever audio is running, and frame deltas are only a fallback for when it is
 * not. Renderers read the committed time from `usePlaybackStore`.
 *
 * Pure logic apart from the store reads — no React, no PixiJS.
 */

import { useSongStore } from "@renderer/stores/useSongStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { getPracticeEngines } from "@renderer/engines/practice/practiceManager";
import { seekPlayback } from "./playbackDiscontinuity";

/** Cap frame delta to prevent large time jumps (e.g. after tab backgrounding) */
export const MAX_DELTA_SECONDS = 0.1;

/** Reads the audio clock's song position, or null when audio is not running. */
export type AudioTimeSource = () => number | null;

/**
 * Build the per-frame transport update.
 *
 * Exposed separately from {@link TransportClock} so the timing rules can be
 * driven with explicit deltas in tests, without a real animation frame loop.
 *
 * @param getAudioCurrentTime  Audio clock source; falls back to frame deltas.
 * @returns A function to call once per frame with the elapsed milliseconds.
 */
export function createTransportTick(
  getAudioCurrentTime?: AudioTimeSource,
): (deltaMs: number) => void {
  return (deltaMs: number): void => {
    const song = useSongStore.getState().song;
    if (!song) return;

    const playState = usePlaybackStore.getState();
    if (!playState.isPlaying) return;
    if (playState.countInActive) return;

    const { waitMode, speedController, loopController } = getPracticeEngines();

    // ── WaitMode gate: if waiting for input, time does not advance ──
    if (usePracticeStore.getState().mode === "wait" && waitMode) {
      if (!waitMode.tick(playState.currentTime)) return;
    }

    let effectiveTime: number;
    const audioTime = getAudioCurrentTime?.();
    if (audioTime != null) {
      effectiveTime = Math.min(audioTime, song.duration);
    } else {
      const dt = Math.min(deltaMs / 1000, MAX_DELTA_SECONDS);
      const speedMultiplier = speedController?.multiplier ?? 1.0;
      effectiveTime = Math.min(
        playState.currentTime + dt * speedMultiplier,
        song.duration,
      );
    }

    // ── Loop check: auto-seek at B point (before writing to store) ──
    if (loopController?.isActive && loopController.shouldLoop(effectiveTime)) {
      effectiveTime = loopController.getLoopStart();
      seekPlayback(effectiveTime, "loop");
    } else {
      // Rendering frames publish ordinary continuous clock movement only.
      playState.setCurrentTime(effectiveTime);
    }

    if (effectiveTime >= song.duration) {
      playState.setPlaying(false);
    }
  };
}

/**
 * Drives {@link createTransportTick} on an animation frame loop.
 *
 * The loop runs for as long as the clock is started, not only during playback;
 * the tick itself is a no-op while paused, which keeps resume instant.
 */
export class TransportClock {
  private readonly _tick: (deltaMs: number) => void;
  private _frameId: number | null = null;
  private _lastFrameMs: number | null = null;

  constructor(getAudioCurrentTime?: AudioTimeSource) {
    this._tick = createTransportTick(getAudioCurrentTime);
  }

  get isRunning(): boolean {
    return this._frameId !== null;
  }

  /** Begin advancing playback time. Safe to call when already running. */
  start(): void {
    if (this._frameId !== null) return;
    if (typeof requestAnimationFrame !== "function") return;

    this._lastFrameMs = null;

    const frame = (nowMs: number): void => {
      const deltaMs =
        this._lastFrameMs === null ? 0 : Math.max(0, nowMs - this._lastFrameMs);
      this._lastFrameMs = nowMs;

      this._tick(deltaMs);

      this._frameId = requestAnimationFrame(frame);
    };

    this._frameId = requestAnimationFrame(frame);
  }

  /** Stop advancing playback time. Safe to call when already stopped. */
  stop(): void {
    if (this._frameId === null) return;
    cancelAnimationFrame(this._frameId);
    this._frameId = null;
    this._lastFrameMs = null;
  }

  dispose(): void {
    this.stop();
  }
}
