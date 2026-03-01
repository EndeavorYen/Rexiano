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
    const { waitMode } = getPracticeEngines();
    if (!waitMode) return;

    // Reset stale track selection from a previous song before initialising
    usePracticeStore.getState().setActiveTracks(new Set());

    const practiceState = usePracticeStore.getState();
    const activeTracks =
      practiceState.activeTracks.size > 0
        ? practiceState.activeTracks
        : new Set(song.tracks.map((_, i) => i));
    if (practiceState.activeTracks.size === 0) {
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
      onWait: () => {
        // Pause audio when waiting for user input
        audioRef.current.scheduler?.stop();
      },
      onResume: () => {
        // Resume audio — read fresh time INSIDE the .then() callback
        const { scheduler, engine } = audioRef.current;
        if (scheduler && engine) {
          void engine.resume().then(() => {
            scheduler.start(usePlaybackStore.getState().currentTime);
          });
        }
      },
    });

    return () => {
      disposePracticeEngines();
    };
  }, [song, audioRef]);

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
          waitMode.stop();
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
        waitMode.init(currentSong.tracks, state.activeTracks);
      }
    });
    return unsub;
  }, []);

  // ── Wire MIDI input → WaitMode.checkInput() ──
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

  // ── Start/stop WaitMode with playback ──
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { waitMode } = getPracticeEngines();
      const practiceMode = usePracticeStore.getState().mode;
      if (!waitMode || practiceMode !== "wait") return;

      if (state.isPlaying && !prev.isPlaying) {
        waitMode.start();
      } else if (!state.isPlaying && prev.isPlaying) {
        waitMode.stop();
      }
    });
    return unsub;
  }, []);

  // ── Loop seek → AudioScheduler sync + WaitMode reset ──
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { loopController, waitMode } = getPracticeEngines();
      if (!loopController?.isActive) return;

      // Detect backward time jump near the loop start point
      if (
        state.currentTime < prev.currentTime &&
        Math.abs(state.currentTime - loopController.getLoopStart()) < 0.1
      ) {
        audioRef.current.scheduler?.seek(state.currentTime);

        // Reset WaitMode so notes are re-judged on the next loop pass
        if (usePracticeStore.getState().mode === "wait" && waitMode) {
          waitMode.reset();
          waitMode.start();
        }
      }
    });
    return unsub;
  }, [audioRef]);

  return { noteRendererRef, handleNoteRendererReady };
}
