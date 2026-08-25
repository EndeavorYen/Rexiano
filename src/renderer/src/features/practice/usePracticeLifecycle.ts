/**
 * Custom hook encapsulating all Phase 6 practice engine lifecycle:
 * - Engine init/dispose tied to song changes
 * - WaitMode callback wiring (hit/miss/wait/resume)
 * - Store → engine synchronization subscriptions
 * - MIDI input → WaitMode routing
 * - Playback → WaitMode start/stop
 * - Loop seek → WaitMode reset + AudioScheduler seek
 *
 * Extracted from App.tsx to keep the root component clean.
 */
import { useRef, useEffect, useCallback } from "react";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import {
  initPracticeEngines,
  getPracticeEngines,
  disposePracticeEngines,
} from "@renderer/engines/practice/practiceManager";
import type { NoteRenderer } from "@renderer/engines/fallingNotes/NoteRenderer";
import type { AudioEngine } from "@renderer/engines/audio/AudioEngine";
import type { AudioScheduler } from "@renderer/engines/audio/AudioScheduler";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { WaitMode } from "@renderer/engines/practice/WaitMode";
import { getMetronome } from "@renderer/engines/metronome/metronomeManager";
import { syncMetronomeToPlayback } from "@renderer/engines/metronome/metronomeRuntime";
import type { PracticeMode } from "@shared/types";

interface AudioRef {
  engine: AudioEngine | null;
  scheduler: AudioScheduler | null;
}

/** Streak milestones that trigger a combo pop — defined once, not on every hit. */
const COMBO_MILESTONES = new Set([5, 10, 25, 50, 100]);

function syncCurrentPracticeMetronome(): void {
  const engine = getMetronome();
  const song = useSongStore.getState().song;
  const playback = usePlaybackStore.getState();
  if (!engine || !song || !playback.isPlaying || playback.countInActive) return;

  syncMetronomeToPlayback({
    engine,
    song,
    currentTime: playback.currentTime,
    speed: usePracticeStore.getState().speed,
    enabled: useSettingsStore.getState().metronomeEnabled,
  });
}

interface PracticeLifecycleResult {
  noteRendererRef: React.MutableRefObject<NoteRenderer | null>;
  handleNoteRendererReady: (renderer: NoteRenderer) => void;
}

export interface InitialPracticeActiveTracksInput {
  trackCount: number;
  activeTracks: Set<number>;
  activeTracksInitialized: boolean;
}

export interface InitialPracticeActiveTracksResult {
  activeTracks: Set<number>;
  shouldStoreDefault: boolean;
}

export function resolveInitialPracticeActiveTracks({
  trackCount,
  activeTracks,
  activeTracksInitialized,
}: InitialPracticeActiveTracksInput): InitialPracticeActiveTracksResult {
  if (activeTracksInitialized || activeTracks.size > 0) {
    return { activeTracks, shouldStoreDefault: false };
  }

  return {
    activeTracks: new Set(Array.from({ length: trackCount }, (_, i) => i)),
    shouldStoreDefault: true,
  };
}

/** Record a non-target NoteOn with a durable, non-colour session key. */
export function recordWrongPracticeInput(
  midi: number,
  sequence: number,
): string {
  const key = `wrong:${sequence}:${midi}`;
  usePracticeStore.getState().recordMiss(key);
  return key;
}

interface WaitPlaybackTransition {
  state: string;
  pause(): void;
  start(): void;
  stop(): void;
}

export function applyPracticePlaybackTransition({
  waitMode,
  isPlaying,
  wasPlaying,
}: {
  waitMode: WaitPlaybackTransition;
  isPlaying: boolean;
  wasPlaying: boolean;
}): void {
  if (isPlaying && !wasPlaying) waitMode.start();
  if (!isPlaying && wasPlaying) waitMode.pause();
}

export function shouldStartPracticeScheduler({
  mode,
  waitState,
}: {
  mode: PracticeMode;
  waitState: string | null;
}): boolean {
  return mode !== "wait" || waitState !== "waiting";
}

export function shouldRouteWaitMidiInput({
  mode,
  isPlaying,
  countInActive,
}: {
  mode: PracticeMode;
  isPlaying: boolean;
  countInActive: boolean;
}): boolean {
  return mode === "wait" && isPlaying && !countInActive;
}

export function applyPracticeModeTransition({
  waitMode,
  nextMode,
  isPlaying,
  resumeScheduler,
}: {
  waitMode: Pick<WaitPlaybackTransition, "state" | "stop">;
  nextMode: PracticeMode;
  isPlaying: boolean;
  resumeScheduler: () => void;
}): void {
  const wasWaiting = waitMode.state === "waiting";
  if (nextMode !== "wait") {
    waitMode.stop();
    if (wasWaiting && isPlaying) resumeScheduler();
  }
}

export function applyPracticeActiveTrackTransition({
  waitMode,
  tracks,
  activeTracks,
  isPlaying,
  mode,
  currentTime,
  resumeScheduler,
}: {
  waitMode: Pick<WaitMode, "state" | "init" | "start" | "advancePast">;
  tracks: ParsedSong["tracks"];
  activeTracks: Set<number>;
  isPlaying: boolean;
  mode: PracticeMode;
  currentTime: number;
  resumeScheduler: () => void;
}): void {
  const wasWaiting = waitMode.state === "waiting";
  waitMode.init(tracks, activeTracks);
  if (mode === "wait" && isPlaying) {
    waitMode.start();
    waitMode.advancePast(currentTime);
    if (wasWaiting) resumeScheduler();
  }
}

export function resetPracticeSession({
  resetWaitMode,
  resetScoreCalculator,
  resetPracticeScore,
}: {
  resetWaitMode: () => void;
  resetScoreCalculator: () => void;
  resetPracticeScore: () => void;
}): void {
  resetWaitMode();
  resetScoreCalculator();
  resetPracticeScore();
}

/**
 * Manages the full Phase 6 practice engine lifecycle for a loaded song.
 *
 * @param song     The currently loaded parsed song, or null when no song is open.
 * @param audioRef Ref holding the active AudioEngine and AudioScheduler instances.
 * @returns        A ref to the NoteRenderer (for hit/miss visual feedback) and
 *                 a callback to receive it once the canvas has mounted.
 */
export function usePracticeLifecycle(
  song: ParsedSong | null,
  audioRef: React.MutableRefObject<AudioRef>,
  onWrongInput?: (midi: number) => void,
): PracticeLifecycleResult {
  const noteRendererRef = useRef<NoteRenderer | null>(null);
  const wrongInputSequenceRef = useRef(0);

  const handleNoteRendererReady = useCallback((renderer: NoteRenderer) => {
    noteRendererRef.current = renderer;
  }, []);

  // ── Init practice engines when a song loads ──
  useEffect(() => {
    if (!song) return;

    initPracticeEngines();
    const { waitMode } = getPracticeEngines();
    if (!waitMode) return;

    const practiceState = usePracticeStore.getState();
    const { activeTracks, shouldStoreDefault } =
      resolveInitialPracticeActiveTracks({
        trackCount: song.tracks.length,
        activeTracks: practiceState.activeTracks,
        activeTracksInitialized: practiceState.activeTracksInitialized,
      });
    if (shouldStoreDefault) {
      usePracticeStore.getState().setActiveTracks(activeTracks);
    }
    waitMode.init(song.tracks, activeTracks);

    // Wire callbacks — read song from store inside to avoid stale closure
    waitMode.setCallbacks({
      onHit: (midi, time) => {
        const key = `${midi}:${Math.round(time * 1e6)}`;
        usePracticeStore.getState().recordHit(key);

        // Visual feedback
        const currentSong = useSongStore.getState().song;
        const nr = noteRendererRef.current;
        if (nr && currentSong) {
          for (let t = 0; t < currentSong.tracks.length; t++) {
            const sprite = nr.findSpriteForNote(t, midi, time);
            if (sprite) {
              nr.flashHit(sprite);
              break;
            }
          }
        }
        // Show combo at milestones
        const score = usePracticeStore.getState().score;
        if (nr && COMBO_MILESTONES.has(score.currentStreak)) {
          nr.showCombo(score.currentStreak, 400, 200);
        }
      },
      onMiss: (midi, time) => {
        const key = `${midi}:${Math.round(time * 1e6)}`;
        usePracticeStore.getState().recordMiss(key);

        // Visual feedback
        const currentSong = useSongStore.getState().song;
        const nr = noteRendererRef.current;
        if (nr && currentSong) {
          for (let t = 0; t < currentSong.tracks.length; t++) {
            const sprite = nr.findSpriteForNote(t, midi, time);
            if (sprite) {
              nr.markMiss(sprite);
              break;
            }
          }
        }
      },
      onWrongInput: (midi) => {
        wrongInputSequenceRef.current += 1;
        recordWrongPracticeInput(midi, wrongInputSequenceRef.current);
        onWrongInput?.(midi);
      },
      onWait: () => {
        // Freeze audio while waiting for input. pause() leaves notes that are
        // already sounding to ring out, where stop() would cut sustained notes
        // at every single wait.
        audioRef.current.scheduler?.pause();
        getMetronome()?.stop();
      },
      onResume: () => {
        const playback = usePlaybackStore.getState();
        if (!playback.isPlaying || playback.countInActive) return;
        // Resume audio — read fresh time INSIDE the .then() callback
        const { scheduler, engine } = audioRef.current;
        if (scheduler && engine) {
          void engine
            .resume()
            .then(() => {
              const livePlayback = usePlaybackStore.getState();
              if (!livePlayback.isPlaying || livePlayback.countInActive) return;
              scheduler.resume(livePlayback.currentTime);
              syncCurrentPracticeMetronome();
            })
            .catch((err) => {
              console.error("WaitMode audio resume failed:", err);
            });
        }
      },
    });

    return () => {
      disposePracticeEngines();
    };
  }, [song, audioRef, onWrongInput]);

  // ── Sync practice store → engine singletons (permanent subscriber) ──
  useEffect(() => {
    const unsub = usePracticeStore.subscribe((state, prev) => {
      const { waitMode, speedController, loopController, scoreCalculator } =
        getPracticeEngines();
      const currentSong = useSongStore.getState().song;

      // Mode change
      if (state.mode !== prev.mode && waitMode && currentSong) {
        if (state.mode === "wait") {
          waitMode.init(currentSong.tracks, state.activeTracks);
          if (usePlaybackStore.getState().isPlaying) {
            waitMode.start();
          }
        } else {
          applyPracticeModeTransition({
            waitMode,
            nextMode: state.mode,
            isPlaying: usePlaybackStore.getState().isPlaying,
            resumeScheduler: () => {
              const scheduler = audioRef.current.scheduler;
              const engine = audioRef.current.engine;
              if (!scheduler || !engine) return;
              void engine
                .resume()
                .then(() => {
                  if (
                    usePracticeStore.getState().mode !== "wait" &&
                    usePlaybackStore.getState().isPlaying
                  ) {
                    scheduler.resume(usePlaybackStore.getState().currentTime);
                    syncCurrentPracticeMetronome();
                  }
                })
                .catch((err) => {
                  console.error("Practice mode audio resume failed:", err);
                });
            },
          });
        }
        scoreCalculator?.reset();
        usePracticeStore.getState().resetScore();
      }

      // Speed change
      if (state.speed !== prev.speed && speedController) {
        speedController.setSpeed(state.speed);
      }

      // Loop range change
      if (state.loopRange !== prev.loopRange && loopController) {
        if (state.loopRange) {
          loopController.setRange(state.loopRange[0], state.loopRange[1]);
        } else {
          loopController.clear();
        }
      }

      // Active tracks change
      if (state.activeTracks !== prev.activeTracks && waitMode && currentSong) {
        applyPracticeActiveTrackTransition({
          waitMode,
          tracks: currentSong.tracks,
          activeTracks: state.activeTracks,
          isPlaying: usePlaybackStore.getState().isPlaying,
          mode: state.mode,
          currentTime: usePlaybackStore.getState().currentTime,
          resumeScheduler: () => {
            const scheduler = audioRef.current.scheduler;
            const engine = audioRef.current.engine;
            if (!scheduler || !engine) return;
            void engine
              .resume()
              .then(() => {
                if (
                  usePracticeStore.getState().mode === "wait" &&
                  usePlaybackStore.getState().isPlaying
                ) {
                  scheduler.resume(usePlaybackStore.getState().currentTime);
                  syncCurrentPracticeMetronome();
                }
              })
              .catch((err) => {
                console.error("Practice track audio resume failed:", err);
              });
          },
        });
      }
    });
    return unsub;
  }, [audioRef]);

  // ── Wire MIDI input → WaitMode.checkInput() ──
  useEffect(() => {
    const unsub = useMidiDeviceStore.subscribe((state, prev) => {
      if (state.activeNotes !== prev.activeNotes) {
        const { waitMode } = getPracticeEngines();
        const practiceMode = usePracticeStore.getState().mode;
        const playback = usePlaybackStore.getState();
        if (
          waitMode &&
          shouldRouteWaitMidiInput({
            mode: practiceMode,
            isPlaying: playback.isPlaying,
            countInActive: playback.countInActive,
          })
        ) {
          waitMode.checkInput(state.activeNotes);
        }
      }
    });
    return unsub;
  }, []);

  // ── Start/stop WaitMode with playback ──
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { waitMode } = getPracticeEngines();
      const practiceMode = usePracticeStore.getState().mode;
      if (!waitMode || practiceMode !== "wait") return;
      applyPracticePlaybackTransition({
        waitMode,
        isPlaying: state.isPlaying,
        wasPlaying: prev.isPlaying,
      });
    });
    return unsub;
  }, []);

  // ── Loop discontinuity → WaitMode reset ──
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { loopController, waitMode } = getPracticeEngines();
      if (!loopController?.isActive) return;

      // Detect backward time jump near the loop start point
      if (
        state.currentTime < prev.currentTime &&
        Math.abs(state.currentTime - loopController.getLoopStart()) < 0.1
      ) {
        // TransportClock already committed the single scheduler/output seek.
        // Reset WaitMode so notes are re-judged on the next loop pass.
        if (usePracticeStore.getState().mode === "wait" && waitMode) {
          waitMode.reset();
          waitMode.start();
        }
      }
    });
    return unsub;
  }, []);

  return { noteRendererRef, handleNoteRendererReady };
}
