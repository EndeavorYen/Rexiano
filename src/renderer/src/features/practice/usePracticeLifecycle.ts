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
 *
 * Match 3 Round 1 fixes:
 * R1-01: WaitMode.start() deferred to after count-in completes (prevents deadlock).
 * R1-02: Missing .catch() on loop-seek resume() promise.
 * R1-03: Fresh speed read inside count-in onComplete (prevents stale BPM closure).
 * R1-05/R1-09: isResumePendingRef guards against concurrent onWait/onResume race.
 * R1-06: scheduler.setSpeed() guarded during count-in (scheduler is stopped).
 * R1-08: scoreCalculator.reset() only fires for scoring-relevant mode changes.
 *
 * Match 3 Round 2 fixes:
 * R2-01: Loop-seek resume uses isResumePendingRef guard (same pattern as onResume).
 * R2-02: Count-in onComplete resume uses isResumePendingRef guard.
 * R2-03: practiceMode read fresh inside onComplete (avoids stale closure).
 * R2-04: Pause handler clears isCountingIn (metronome.stop nulls onComplete).
 * R2-06: Pause handler clears isResumePendingRef (prevents stale .then() firing).
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
import {
  getTempoAtTime,
  type ParsedSong,
} from "@renderer/engines/midi/types";

interface AudioRef {
  engine: AudioEngine | null;
  scheduler: AudioScheduler | null;
}

/** Streak milestones that trigger a combo pop -- defined once, not on every hit. */
const COMBO_MILESTONES = new Set([5, 10, 25, 50, 100]);

/**
 * R2-01/R2-02 fix: Extracted resume-and-start pattern into a single helper.
 * Uses a generation counter (not a boolean) to eliminate the ABA race:
 * each call increments the counter; the .then() only proceeds if its
 * captured generation still matches the current value.
 *
 * @param engine      The AudioEngine to resume
 * @param scheduler   The AudioScheduler to start after resume
 * @param genRef      Mutable ref holding the current generation counter
 * @param label       Log label for error context
 * @param onSettled   Optional callback invoked after resume settles (success or failure)
 */
function guardedResumeAndStart(
  engine: AudioEngine,
  scheduler: AudioScheduler,
  genRef: React.MutableRefObject<number>,
  label: string,
  onSettled?: () => void,
): void {
  const gen = ++genRef.current;
  void engine
    .resume()
    .then(() => {
      if (genRef.current === gen && usePlaybackStore.getState().isPlaying) {
        scheduler.start(usePlaybackStore.getState().currentTime);
      }
      onSettled?.();
    })
    .catch((err) => {
      console.error(`${label} audio resume failed:`, err);
      // R3-01 fix: Stop playback on resume failure so the UI doesn't show
      // an active play button with no audio. Without this, Rex sees a
      // "playing" state but hears nothing and won't know to press stop.
      usePlaybackStore.getState().setPlaying(false);
      onSettled?.();
    });
}

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
  // R1-04 fix: update ref during render (sync) instead of post-paint useEffect (async).
  // Eliminates the stale-ref window between render and effect execution.
  callbacksRef.current = callbacks;
  const noteRendererRef = useRef<NoteRenderer | null>(null);

  /**
   * R2-01 fix: Generation counter for the resume-and-start guard.
   * Replaces the boolean isResumePendingRef to eliminate the ABA race.
   * Each guardedResumeAndStart() call increments this counter; the .then()
   * only starts the scheduler if its captured generation still matches.
   */
  const resumeGenRef = useRef(0);

  const handleNoteRendererReady = useCallback((renderer: NoteRenderer) => {
    noteRendererRef.current = renderer;
  }, []);

  // ── Init practice engines when a song loads ──
  useEffect(() => {
    if (!song) return;

    initPracticeEngines();
    const { waitMode, speedController } = getPracticeEngines();
    if (!waitMode) {
      return () => {
        disposePracticeEngines();
      };
    }

    // Sync current store speed to newly-created SpeedController so it doesn't
    // default to 1.0 when the user had a different speed set previously.
    // Use setSpeedImmediate to skip the lerp — avoids a ~200ms window of wrong speed.
    const currentSpeed = usePracticeStore.getState().speed;
    speedController?.setSpeedImmediate(currentSpeed);

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
        // R2-01 fix: Increment generation to invalidate ALL pending resumes.
        // Any in-flight .then() will see its captured gen !== current and skip.
        resumeGenRef.current++;
        // Pause audio when waiting for user input
        audioRef.current.scheduler?.stop();
        usePracticeStore.getState().setWaiting(true);
      },
      onResume: () => {
        usePracticeStore.getState().setWaiting(false);
        const { scheduler, engine } = audioRef.current;
        if (scheduler && engine && usePlaybackStore.getState().isPlaying) {
          guardedResumeAndStart(engine, scheduler, resumeGenRef, "WaitMode");
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
        // R1-08: Only reset score when entering/leaving modes that track score
        // (wait or free). watch↔step switches don't use scoring.
        if (
          state.mode === "wait" ||
          state.mode === "free" ||
          prev.mode === "wait" ||
          prev.mode === "free"
        ) {
          scoreCalculator?.reset();
        }
      }

      // Speed change -- also sync metronome BPM and AudioScheduler (R2-002 + R3-003: merged)
      if (state.speed !== prev.speed) {
        speedController?.setSpeed(state.speed);

        // R1-06: Only sync AudioScheduler speed when not counting in —
        // during count-in the scheduler is stopped, and setSpeed() re-anchors
        // timing which is meaningless on a stopped scheduler.
        if (!usePlaybackStore.getState().isCountingIn) {
          audioRef.current.scheduler?.setSpeed(state.speed);
        }

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

      // Active tracks change — re-init WaitMode with new tracks, and restart
      // if currently playing so it doesn't stay stuck in "idle" state.
      if (state.activeTracks !== prev.activeTracks && waitMode && currentSong) {
        waitMode.init(currentSong.tracks, state.activeTracks);
        if (state.mode === "wait" && usePlaybackStore.getState().isPlaying) {
          waitMode.start();
        }
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

            // R1-01: Do NOT start WaitMode here — it would enter "playing"
            // state, and tickerLoop would call tick() during count-in,
            // transitioning to "waiting" before the scheduler even starts.
            // WaitMode is started inside onComplete below.

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

                // R1-01: Start WaitMode AFTER count-in completes, right
                // before the scheduler starts, so tick() can't fire prematurely.
                // R2-03: Read practiceMode fresh — user may have changed mode
                // during count-in, so the closure-captured value is stale.
                const freshMode = usePracticeStore.getState().mode;
                if (waitMode && freshMode === "wait") {
                  waitMode.start();
                }

                const { scheduler: sch, engine } = audioRef.current;
                if (sch && engine) {
                  // R1-03: Read current speed fresh to avoid stale closure
                  const freshSpeed = usePracticeStore.getState().speed;
                  const { bpm: freshBpm } = getTempoAtTime(
                    usePlaybackStore.getState().currentTime,
                    currentSong.tempos,
                    currentSong.timeSignatures,
                  );
                  sch.setSpeed(freshSpeed);
                  metronome.setBpm(freshBpm * freshSpeed);

                  // R2-01/R2-02 fix: use shared helper with generation counter
                  guardedResumeAndStart(
                    engine,
                    sch,
                    resumeGenRef,
                    "Count-in",
                    () => usePlaybackStore.getState().setCountingIn(false),
                  );
                } else {
                  usePlaybackStore.getState().setCountingIn(false);
                }
              },
            );
          } else {
            // R1-01: No count-in — start WaitMode immediately (no deadlock risk)
            if (waitMode && practiceMode === "wait") {
              waitMode.start();
            }

            if (metronomeEnabled) {
              metronome.start(effectiveBpm, beatsPerMeasure);
            }
          }
        } else {
          // No metronome or no song — start WaitMode immediately
          if (waitMode && practiceMode === "wait") {
            waitMode.start();
          }
        }
      }

      // ── Pause ──
      if (!state.isPlaying && prev.isPlaying) {
        if (waitMode && practiceMode === "wait") {
          waitMode.stop();
        }
        metronome?.stop();
        // R2-04: metronome.stop() nulls the onComplete callback, so
        // setCountingIn(false) would never fire from it. Clear here.
        usePlaybackStore.getState().setCountingIn(false);
        // R2-06: Cancel any in-flight resume — if .then() fires after pause,
        // it must not start the scheduler in a new play session.
        resumeGenRef.current++;
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
          const wasWaiting = usePracticeStore.getState().isWaiting;
          waitMode.reset();
          waitMode.start();
          // If onWait had stopped the scheduler, restart it for the new loop iteration
          if (wasWaiting) {
            usePracticeStore.getState().setWaiting(false);
            const { scheduler, engine } = audioRef.current;
            if (scheduler && engine && usePlaybackStore.getState().isPlaying) {
              guardedResumeAndStart(engine, scheduler, resumeGenRef, "Loop-seek");
            }
          }
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

// getTempoAtTime is now imported from @renderer/engines/midi/types (R1-04 S4 fix)
