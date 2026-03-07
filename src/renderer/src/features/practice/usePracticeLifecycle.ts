/**
 * Custom hook encapsulating all Phase 6 practice engine lifecycle:
 * - Engine init/dispose tied to song changes
 * - WaitMode callback wiring (hit/miss/wait/resume)
 * - Store -> engine synchronization subscriptions
 * - MIDI input -> WaitMode routing
 * - Playback -> WaitMode start/stop
 * - Loop seek -> WaitMode reset + AudioScheduler seek
 * - Metronome integration (count-in, tempo/time-sig sync, volume)
 *
 * Extracted from App.tsx to keep the root component clean.
 *
 * R2-002: Related subscribers are merged where possible to guarantee ordering.
 * R2-001 + R2-010: Count-in sets isCountingIn flag; onComplete checks isPlaying
 *   and awaits engine.resume() before starting scheduler.
 * R2-004: Timing delta uses playback currentTime at moment of hit.
 * R2-008: Dead code in activeTracks init removed.
 * R2-009: Metronome resetBeat() called on seek.
 * R3-002: Metronome disable during count-in clears isCountingIn.
 * R3-003: Speed subscriber merged — scheduler.setSpeed included here.
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
import { getMetronome } from "@renderer/engines/metronome/metronomeManager";
import type { NoteRenderer } from "@renderer/engines/fallingNotes/NoteRenderer";
import type { AudioEngine } from "@renderer/engines/audio/AudioEngine";
import type { AudioScheduler } from "@renderer/engines/audio/AudioScheduler";
import type {
  ParsedSong,
  TempoEvent,
  TimeSignatureEvent,
} from "@renderer/engines/midi/types";

interface AudioRef {
  engine: AudioEngine | null;
  scheduler: AudioScheduler | null;
}

/** Streak milestones that trigger a combo pop -- defined once, not on every hit. */
const COMBO_MILESTONES = new Set([5, 10, 25, 50, 100]);

interface PracticeLifecycleCallbacks {
  onHitNote?: (midi: number) => void;
  onMissNote?: (midi: number) => void;
}

interface PracticeLifecycleResult {
  noteRendererRef: React.MutableRefObject<NoteRenderer | null>;
  handleNoteRendererReady: (renderer: NoteRenderer) => void;
}

/**
 * Manages the full Phase 6 practice engine lifecycle for a loaded song.
 *
 * @param song     The currently loaded parsed song, or null when no song is open.
 * @param audioRef Ref holding the active AudioEngine and AudioScheduler instances.
 * @param callbacks Optional callbacks for hit/miss note events (e.g. keyboard highlights).
 * @returns        A ref to the NoteRenderer (for hit/miss visual feedback) and
 *                 a callback to receive it once the canvas has mounted.
 */
export function usePracticeLifecycle(
  song: ParsedSong | null,
  audioRef: React.MutableRefObject<AudioRef>,
  callbacks?: PracticeLifecycleCallbacks,
): PracticeLifecycleResult {
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });
  const noteRendererRef = useRef<NoteRenderer | null>(null);

  const handleNoteRendererReady = useCallback((renderer: NoteRenderer) => {
    noteRendererRef.current = renderer;
  }, []);

  // ── Init practice engines when a song loads ──
  useEffect(() => {
    if (!song) return;

    initPracticeEngines();
    const { waitMode } = getPracticeEngines();
    if (!waitMode) return;

    // R2-008: Always initialize activeTracks to all tracks for a new song.
    const allTracks = new Set(song.tracks.map((_, i) => i));
    usePracticeStore.getState().setActiveTracks(allTracks);
    waitMode.init(song.tracks, allTracks);

    // Wire callbacks -- read song from store inside to avoid stale closure
    waitMode.setCallbacks({
      onHit: (midi, time) => {
        const key = `${midi}:${Math.round(time * 1e6)}`;
        // R2-004: Compute timing delta using current playback time (not frozen WaitMode time)
        // R3-001: In WaitMode, timing delta is not meaningful (user waits indefinitely),
        // so we pass undefined to skip delta tracking for wait mode.
        const practiceMode = usePracticeStore.getState().mode;
        let timingDeltaMs: number | undefined;
        if (practiceMode !== "wait") {
          const currentTime = usePlaybackStore.getState().currentTime;
          timingDeltaMs = (currentTime - time) * 1000;
        }
        usePracticeStore.getState().recordHit(key, timingDeltaMs);

        // Visual feedback on falling notes
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
          nr.showCombo(score.currentStreak);
        }
        // Notify keyboard highlight
        callbacksRef.current?.onHitNote?.(midi);
      },
      onMiss: (midi, time) => {
        const key = `${midi}:${Math.round(time * 1e6)}`;
        usePracticeStore.getState().recordMiss(key);

        // Visual feedback on falling notes
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
        // Notify keyboard highlight
        callbacksRef.current?.onMissNote?.(midi);
      },
      onWait: () => {
        // Pause audio when waiting for user input
        audioRef.current.scheduler?.stop();
        usePracticeStore.getState().setWaiting(true);
      },
      onResume: () => {
        usePracticeStore.getState().setWaiting(false);
        // R2-001: Check isPlaying before resuming, and await engine.resume()
        const { scheduler, engine } = audioRef.current;
        if (scheduler && engine && usePlaybackStore.getState().isPlaying) {
          void engine
            .resume()
            .then(() => {
              // Re-check isPlaying after async resume (user may have paused)
              if (usePlaybackStore.getState().isPlaying) {
                scheduler.start(usePlaybackStore.getState().currentTime);
              }
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
  }, [song, audioRef]);

  // ── Sync practice store -> engine singletons (permanent subscriber) ──
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
          waitMode.stop();
        }
        scoreCalculator?.reset();
        usePracticeStore.getState().resetScore();
      }

      // Speed change -- also sync metronome BPM and AudioScheduler (R2-002 + R3-003: merged)
      if (state.speed !== prev.speed) {
        speedController?.setSpeed(state.speed);

        // R3-003: Sync AudioScheduler speed here instead of in App.tsx
        audioRef.current.scheduler?.setSpeed(state.speed);

        const metronome = getMetronome();
        if (metronome?.isRunning && currentSong) {
          const currentTime = usePlaybackStore.getState().currentTime;
          const { bpm } = getTempoAtTime(
            currentTime,
            currentSong.tempos,
            currentSong.timeSignatures,
          );
          metronome.setBpm(bpm * state.speed);
        }
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
        waitMode.init(currentSong.tracks, state.activeTracks);
      }
    });
    return unsub;
  }, [audioRef]);

  // ── Wire MIDI input -> WaitMode.checkInput() ──
  useEffect(() => {
    const unsub = useMidiDeviceStore.subscribe((state, prev) => {
      if (state.activeNotes !== prev.activeNotes) {
        const { waitMode } = getPracticeEngines();
        const practiceMode = usePracticeStore.getState().mode;
        if (waitMode && practiceMode === "wait") {
          waitMode.checkInput(state.activeNotes);
        }
      }
    });
    return unsub;
  }, []);

  // ── R2-002: Merged playback subscriber for WaitMode + loop seek + metronome + tempo ──
  // This single subscriber handles all playback state changes, guaranteeing
  // consistent ordering and avoiding multiple independent listeners.
  useEffect(() => {
    let lastBpm = 0;
    let lastBeatsPerMeasure = 0;

    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { waitMode, loopController } = getPracticeEngines();
      const practiceMode = usePracticeStore.getState().mode;
      const currentSong = useSongStore.getState().song;
      const metronome = getMetronome();

      // ── Play start ──
      if (state.isPlaying && !prev.isPlaying) {
        // Start WaitMode
        if (waitMode && practiceMode === "wait") {
          waitMode.start();
        }

        // Start metronome (with optional count-in)
        if (metronome && currentSong) {
          const { metronomeEnabled, countInBeats } =
            useSettingsStore.getState();
          metronome.setEnabled(metronomeEnabled);

          const speed = usePracticeStore.getState().speed;
          const { bpm, beatsPerMeasure } = getTempoAtTime(
            state.currentTime,
            currentSong.tempos,
            currentSong.timeSignatures,
          );
          const effectiveBpm = bpm * speed;

          if (countInBeats > 0 && metronomeEnabled) {
            // R2-010: Set isCountingIn BEFORE starting count-in
            usePlaybackStore.getState().setCountingIn(true);
            const { scheduler } = audioRef.current;
            scheduler?.stop();

            metronome.startCountIn(
              countInBeats,
              effectiveBpm,
              beatsPerMeasure,
              () => {
                // R2-001: Count-in finished -- check isPlaying, await resume
                const playState = usePlaybackStore.getState();
                if (!playState.isPlaying) {
                  // User pressed pause during count-in
                  playState.setCountingIn(false);
                  return;
                }

                const { scheduler: sch, engine } = audioRef.current;
                if (sch && engine) {
                  void engine
                    .resume()
                    .then(() => {
                      // Re-check after async resume
                      if (usePlaybackStore.getState().isPlaying) {
                        sch.start(usePlaybackStore.getState().currentTime);
                      }
                      usePlaybackStore.getState().setCountingIn(false);
                    })
                    .catch((err: unknown) => {
                      console.error("Audio resume after count-in failed:", err);
                      usePlaybackStore.getState().setCountingIn(false);
                    });
                } else {
                  usePlaybackStore.getState().setCountingIn(false);
                }
              },
            );
          } else if (metronomeEnabled) {
            metronome.start(effectiveBpm, beatsPerMeasure);
          }
        }
      }

      // ── Pause ──
      if (!state.isPlaying && prev.isPlaying) {
        if (waitMode && practiceMode === "wait") {
          waitMode.stop();
        }
        metronome?.stop();
      }

      // ── R3-006: Block seek during count-in ──
      // (Seek detection is skipped when counting in to avoid corrupted state)
      if (state.isCountingIn) return;

      // ── Loop seek detection ──
      if (
        loopController?.isActive &&
        state.currentTime < prev.currentTime &&
        Math.abs(state.currentTime - loopController.getLoopStart()) < 0.1
      ) {
        audioRef.current.scheduler?.seek(state.currentTime);

        // R2-009: Reset metronome beat position on seek
        metronome?.resetBeat();

        if (practiceMode === "wait" && waitMode) {
          waitMode.reset();
          waitMode.start();
        }
      }

      // ── Tempo / time-sig tracking during playback ──
      if (
        state.currentTime !== prev.currentTime &&
        state.isPlaying &&
        metronome?.isRunning &&
        currentSong
      ) {
        const speed = usePracticeStore.getState().speed;
        const { bpm, beatsPerMeasure } = getTempoAtTime(
          state.currentTime,
          currentSong.tempos,
          currentSong.timeSignatures,
        );
        const effectiveBpm = bpm * speed;

        if (effectiveBpm !== lastBpm) {
          metronome.setBpm(effectiveBpm);
          lastBpm = effectiveBpm;
        }
        if (beatsPerMeasure !== lastBeatsPerMeasure) {
          metronome.setBeatsPerMeasure(beatsPerMeasure);
          lastBeatsPerMeasure = beatsPerMeasure;
        }
      }
    });
    return unsub;
  }, [audioRef]);

  // ── Sync metronome volume with app volume + R3-002: metronome disable clears isCountingIn ──
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      const metronome = getMetronome();
      if (!metronome) return;

      // Volume / mute change
      if (state.volume !== prev.volume || state.muted !== prev.muted) {
        metronome.setVolume(state.muted ? 0 : state.volume / 100);
      }

      // Metronome enabled toggle while playing
      if (state.metronomeEnabled !== prev.metronomeEnabled) {
        metronome.setEnabled(state.metronomeEnabled);

        const { isPlaying, currentTime } = usePlaybackStore.getState();

        // R3-002: If metronome disabled during count-in, clear isCountingIn to prevent freeze
        if (!state.metronomeEnabled) {
          metronome.stop();
          usePlaybackStore.getState().setCountingIn(false);
        }

        if (!isPlaying) return;

        const currentSong = useSongStore.getState().song;
        if (!currentSong) return;

        if (state.metronomeEnabled && !metronome.isRunning) {
          const speed = usePracticeStore.getState().speed;
          const { bpm, beatsPerMeasure } = getTempoAtTime(
            currentTime,
            currentSong.tempos,
            currentSong.timeSignatures,
          );
          metronome.start(bpm * speed, beatsPerMeasure);
        }
      }
    });
    return unsub;
  }, []);

  return { noteRendererRef, handleNoteRendererReady };
}

// ── Helper: resolve tempo and time signature at a given playback time ──
function getTempoAtTime(
  time: number,
  tempos: TempoEvent[],
  timeSignatures: TimeSignatureEvent[],
): { bpm: number; beatsPerMeasure: number } {
  // Find the effective tempo at `time`
  let bpm = 120; // MIDI default
  for (let i = tempos.length - 1; i >= 0; i--) {
    if (tempos[i].time <= time) {
      bpm = tempos[i].bpm;
      break;
    }
  }

  // Find the effective time signature at `time`
  let beatsPerMeasure = 4; // default 4/4
  for (let i = timeSignatures.length - 1; i >= 0; i--) {
    if (timeSignatures[i].time <= time) {
      beatsPerMeasure = timeSignatures[i].numerator;
      break;
    }
  }

  return { bpm, beatsPerMeasure };
}
