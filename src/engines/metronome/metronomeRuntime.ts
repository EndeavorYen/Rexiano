import type { ParsedSong } from "@renderer/engines/midi/types";
import type { MetronomeStartAlignment } from "./MetronomeEngine";
import type { PlaybackDiscontinuityReason } from "@renderer/engines/transport/playbackDiscontinuity";
import {
  resolveMetronomeTiming,
  shouldRunPlaybackCountIn,
} from "./metronomeTiming";

export interface MetronomeRuntimeEngine {
  setEnabled(enabled: boolean): void;
  start(
    bpm: number,
    beatsPerMeasure: number,
    alignment?: MetronomeStartAlignment,
  ): void;
  startCountIn(
    beats: number,
    bpm: number,
    beatsPerMeasure: number,
    onComplete: () => void,
  ): void;
  stop(): void;
}

export interface LiveMetronomePlaybackState {
  song: ParsedSong | null;
  isPlaying: boolean;
  countInActive: boolean;
  currentTime: number;
  speed: number;
  metronomeEnabled: boolean;
}

export function syncMetronomeToPlayback({
  engine,
  song,
  currentTime,
  speed,
  enabled,
}: {
  engine: MetronomeRuntimeEngine;
  song: ParsedSong;
  currentTime: number;
  speed: number;
  enabled: boolean;
}): void {
  engine.setEnabled(enabled);
  if (!enabled) {
    engine.stop();
    return;
  }

  const timing = resolveMetronomeTiming(song, currentTime, speed);
  engine.start(timing.bpm, timing.beatsPerMeasure, {
    currentBeat: timing.currentBeat,
    firstClickBeat: timing.firstClickBeat,
    firstClickDelaySeconds: timing.firstClickDelaySeconds,
  });
}

export function beginMetronomePlayback({
  engine,
  song,
  currentTime,
  speed,
  metronomeEnabled,
  countInBeats,
  setCountInActive,
  startTransport,
  getLiveState,
}: {
  engine: MetronomeRuntimeEngine;
  song: ParsedSong;
  currentTime: number;
  speed: number;
  metronomeEnabled: boolean;
  countInBeats: number;
  setCountInActive: (active: boolean) => void;
  startTransport: (songTime: number) => void;
  getLiveState: () => LiveMetronomePlaybackState;
}): "count-in" | "started" {
  engine.setEnabled(metronomeEnabled);

  if (shouldRunPlaybackCountIn({ currentTime, countInBeats })) {
    const timing = resolveMetronomeTiming(song, currentTime, speed);
    setCountInActive(true);
    engine.startCountIn(
      countInBeats,
      timing.bpm,
      timing.beatsPerMeasure,
      () => {
        const live = getLiveState();
        if (live.song !== song || !live.isPlaying || !live.countInActive) {
          setCountInActive(false);
          engine.stop();
          return;
        }

        setCountInActive(false);
        startTransport(live.currentTime);
        syncMetronomeToPlayback({
          engine,
          song,
          currentTime: live.currentTime,
          speed: live.speed,
          enabled: live.metronomeEnabled,
        });
      },
    );
    return "count-in";
  }

  setCountInActive(false);
  startTransport(currentTime);
  syncMetronomeToPlayback({
    engine,
    song,
    currentTime,
    speed,
    enabled: metronomeEnabled,
  });
  return "started";
}

export function rebaseMetronomeDiscontinuity({
  reason,
  targetTime,
  countInActive,
  stopCountIn,
  setCountInActive,
  startTransport,
  syncMetronome,
}: {
  reason: PlaybackDiscontinuityReason;
  targetTime: number;
  countInActive: boolean;
  stopCountIn: () => void;
  setCountInActive: (active: boolean) => void;
  startTransport: (songTime: number) => void;
  syncMetronome: () => void;
}): void {
  if (reason === "manual-reset") {
    stopCountIn();
    setCountInActive(false);
    return;
  }

  if (countInActive) {
    stopCountIn();
    setCountInActive(false);
    startTransport(targetTime);
  }
  syncMetronome();
}
