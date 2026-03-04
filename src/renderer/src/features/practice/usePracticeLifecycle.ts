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
import {
  initPracticeEngines,
  getPracticeEngines,
  disposePracticeEngines,
} from "@renderer/engines/practice/practiceManager";
import type { NoteRenderer } from "@renderer/engines/fallingNotes/NoteRenderer";
import type { AudioEngine } from "@renderer/engines/audio/AudioEngine";
import type { AudioScheduler } from "@renderer/engines/audio/AudioScheduler";
import type { ParsedSong } from "@renderer/engines/midi/types";

interface AudioRef {
  engine: AudioEngine | null;
  scheduler: AudioScheduler | null;
}

/** Streak milestones that trigger a combo pop — defined once, not on every hit. */
const COMBO_MILESTONES = new Set([5, 10, 25, 50, 100]);

interface PracticeLifecycleResult {
  noteRendererRef: React.MutableRefObject<NoteRenderer | null>;
  handleNoteRendererReady: (renderer: NoteRenderer) => void;
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
): PracticeLifecycleResult {
  const noteRendererRef = useRef<NoteRenderer | null>(null);

  const handleNoteRendererReady = useCallback((renderer: NoteRenderer) => {
    noteRendererRef.current = renderer;
  }, []);

  // ── Init practice engines when a song loads ──
  useEffect(() => {
    if (!song) return;

    initPracticeEngines();
    const { waitMode, freeScorer } = getPracticeEngines();
    if (!waitMode) return;

    const practiceState = usePracticeStore.getState();
    // Default to all tracks if no selection exists or selection is from a different song
    const maxTrackIndex = song.tracks.length - 1;
    const hasValidSelection = practiceState.activeTracks.size > 0 &&
      Array.from(practiceState.activeTracks).every(i => i <= maxTrackIndex);
    const activeTracks = hasValidSelection
      ? practiceState.activeTracks
      : new Set(song.tracks.map((_, i) => i));
    if (!hasValidSelection) {
      usePracticeStore.getState().setActiveTracks(activeTracks);
    }
    waitMode.init(song.tracks, activeTracks);
    freeScorer?.init(song.tracks, activeTracks);

    /** Shared hit callback for both WaitMode and FreeScorer */
    const handleHit = (midi: number, time: number): void => {
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
    };

    /** Shared miss callback for both WaitMode and FreeScorer */
    const handleMiss = (midi: number, time: number): void => {
      const key = `${midi}:${Math.round(time * 1e6)}`;
      usePracticeStore.getState().recordMiss(key);

      // Audio feedback — gentle error tone (only in Wait mode)
      if (usePracticeStore.getState().mode === "wait") {
        audioRef.current.engine?.playErrorTone();
      }

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
    };

    // Wire WaitMode callbacks
    waitMode.setCallbacks({
      onHit: handleHit,
      onMiss: handleMiss,
      onWait: () => {
        // Pause audio when waiting for user input
        audioRef.current.scheduler?.stop();
      },
      onResume: () => {
        // Resume audio — read fresh time INSIDE the .then() callback
        const { scheduler, engine } = audioRef.current;
        if (scheduler && engine) {
          void engine
            .resume()
            .then(() => {
              scheduler.start(usePlaybackStore.getState().currentTime);
            })
            .catch((err) => {
              console.error("WaitMode audio resume failed:", err);
            });
        }
      },
    });

    // Wire FreeScorer callbacks (same hit/miss logic, no wait/resume)
    freeScorer?.setCallbacks({
      onHit: handleHit,
      onMiss: handleMiss,
    });

    return () => {
      disposePracticeEngines();
    };
  }, [song, audioRef]);

  // ── Sync practice store → engine singletons (permanent subscriber) ──
  useEffect(() => {
    const unsub = usePracticeStore.subscribe((state, prev) => {
      const { waitMode, speedController, loopController, scoreCalculator, freeScorer } =
        getPracticeEngines();
      const currentSong = useSongStore.getState().song;

      // Mode change
      if (state.mode !== prev.mode && currentSong) {
        // Stop previous mode engines
        waitMode?.stop();
        freeScorer?.stop();

        if (state.mode === "wait" && waitMode) {
          waitMode.init(currentSong.tracks, state.activeTracks);
          if (usePlaybackStore.getState().isPlaying) {
            waitMode.start();
          }
        } else if (state.mode === "free" && freeScorer) {
          freeScorer.init(currentSong.tracks, state.activeTracks);
          if (usePlaybackStore.getState().isPlaying) {
            freeScorer.start();
          }
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
      if (state.activeTracks !== prev.activeTracks && currentSong) {
        waitMode?.init(currentSong.tracks, state.activeTracks);
        freeScorer?.init(currentSong.tracks, state.activeTracks);
      }
    });
    return unsub;
  }, []);

  // ── Wire MIDI input → WaitMode / FreeScorer ──
  useEffect(() => {
    const unsub = useMidiDeviceStore.subscribe((state, prev) => {
      if (state.activeNotes !== prev.activeNotes) {
        const { waitMode, freeScorer } = getPracticeEngines();
        const practiceMode = usePracticeStore.getState().mode;
        if (practiceMode === "wait" && waitMode) {
          waitMode.checkInput(state.activeNotes);
        } else if (practiceMode === "free" && freeScorer) {
          const currentTime = usePlaybackStore.getState().currentTime;
          freeScorer.checkInput(state.activeNotes, currentTime);
        }
      }
    });
    return unsub;
  }, []);

  // ── Start/stop WaitMode / FreeScorer with playback ──
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { waitMode, freeScorer } = getPracticeEngines();
      const practiceMode = usePracticeStore.getState().mode;

      if (state.isPlaying && !prev.isPlaying) {
        if (practiceMode === "wait" && waitMode) waitMode.start();
        if (practiceMode === "free" && freeScorer) freeScorer.start();
      } else if (!state.isPlaying && prev.isPlaying) {
        if (practiceMode === "wait" && waitMode) waitMode.stop();
        if (practiceMode === "free" && freeScorer) freeScorer.stop();
      }

      // Tick FreeScorer on time changes to detect misses
      if (
        practiceMode === "free" &&
        freeScorer &&
        state.isPlaying &&
        state.currentTime !== prev.currentTime
      ) {
        freeScorer.tick(state.currentTime);
      }
    });
    return unsub;
  }, []);

  // ── Loop seek → AudioScheduler sync + WaitMode reset ──
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { loopController, waitMode, freeScorer } = getPracticeEngines();
      if (!loopController?.isActive) return;

      // Detect backward time jump near the loop start point
      if (
        state.currentTime < prev.currentTime &&
        Math.abs(state.currentTime - loopController.getLoopStart()) < 0.1
      ) {
        audioRef.current.scheduler?.seek(state.currentTime);

        const practiceMode = usePracticeStore.getState().mode;

        // Reset WaitMode so notes are re-judged on the next loop pass
        if (practiceMode === "wait" && waitMode) {
          waitMode.reset();
          waitMode.start();

          // Resume audio playback after the loop reset
          const { scheduler, engine } = audioRef.current;
          if (scheduler && engine) {
            scheduler.start(state.currentTime);
            void engine.resume().catch((err) => {
              console.error("Loop restart audio resume failed:", err);
            });
          }
        }

        // Reset FreeScorer so notes are re-judged on the next loop pass
        if (practiceMode === "free" && freeScorer) {
          freeScorer.reset();
        }
      }
    });
    return unsub;
  }, [audioRef]);

  return { noteRendererRef, handleNoteRendererReady };
}
