import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ArrowLeft, PanelRightOpen, X } from "lucide-react";
import appIcon from "../../../docs/assets/rexiano-icon.png";
import { parseMidiFile } from "./engines/midi/MidiFileParser";
import { getTempoAtTime } from "./engines/midi/types";
import { useSongStore } from "./stores/useSongStore";
import { usePlaybackStore } from "./stores/usePlaybackStore";
import { useProgressStore, initAutoSave } from "./stores/useProgressStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import {
  initMetronome,
  disposeMetronome,
  getMetronome,
} from "./engines/metronome/metronomeManager";
import { AudioEngine } from "./engines/audio/AudioEngine";
import { AudioScheduler } from "./engines/audio/AudioScheduler";
import {
  AUDIO_DEVICECHANGE_DEBOUNCE_MS,
  AUDIO_RECOVERY_MAX_ATTEMPTS,
  extractAudioOutputIds,
  hasAudioOutputChanged,
  withTimeout,
} from "./engines/audio/recoveryUtils";
import { runRecoveryLoop } from "./engines/audio/runRecoveryLoop";
import { FallingNotesCanvas } from "./features/fallingNotes/FallingNotesCanvas";
import { PianoKeyboard } from "./features/fallingNotes/PianoKeyboard";
import { TransportBar } from "./features/fallingNotes/TransportBar";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { SongLibrary } from "./features/songLibrary/SongLibrary";
import { DeviceSelector } from "./features/midiDevice/DeviceSelector";
import {
  useMidiDeviceStore,
  setMidiCCHandler,
} from "./stores/useMidiDeviceStore";
import { usePracticeLifecycle } from "./features/practice/usePracticeLifecycle";
import { PracticeToolbar } from "./features/practice/PracticeToolbar";
import { ScoreOverlay } from "./features/practice/ScoreOverlay";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { toggleMute } from "./hooks/useMuteController";
import { useTranslation } from "./i18n/useTranslation";
import { SheetMusicPanelOSMD } from "./features/sheetMusic/SheetMusicPanelOSMD";
import { DisplayModeToggle } from "./features/sheetMusic/DisplayModeToggle";
import { usePracticeStore } from "./stores/usePracticeStore";
import { computeKeyboardRange } from "./engines/fallingNotes/computeKeyboardRange";
import { SongCompleteOverlay } from "./features/practice/SongCompleteOverlay";
import { MainMenu } from "./features/mainMenu/MainMenu";
import {
  parseRouteHash,
  resolveRoute,
  routeToHash,
  type AppRoute,
} from "./features/routing/appRoute";

/** Accepted file extensions for drag-and-drop MIDI import */
const MIDI_EXTENSIONS = [".mid", ".midi"];

/** R3-03 fix: stable empty Set reference for initial state — avoids reference instability on mount */
const EMPTY_NOTE_SET = new Set<number>();

function App(): React.JSX.Element {
  const { t } = useTranslation();
  const song = useSongStore((s) => s.song);
  const loadSong = useSongStore((s) => s.loadSong);
  const reset = usePlaybackStore((s) => s.reset);
  const keyboardRangePref = usePracticeStore((s) => s.keyboardRange);
  const { firstNote, lastNote } = useMemo(() => {
    if (keyboardRangePref === "full" || !song)
      return { firstNote: 21, lastNote: 108 };
    return computeKeyboardRange(song);
  }, [song, keyboardRangePref]);
  const [routeIntent, setRouteIntent] = useState<AppRoute>(() => {
    if (typeof window === "undefined") return "menu";
    return parseRouteHash(window.location.hash);
  });
  const [showMenuSettings, setShowMenuSettings] = useState(false);

  // Routing rule source of truth:
  // - Has song => playback
  // - No song + playback route => menu
  const view: AppRoute = resolveRoute(routeIntent, !!song);
  const [showPlaybackDrawer, setShowPlaybackDrawer] = useState(false);

  const applyRoute = useCallback((nextRoute: AppRoute): void => {
    if (nextRoute !== "playback") {
      setShowPlaybackDrawer(false);
    }
    setRouteIntent(nextRoute);
    if (typeof window === "undefined") return;
    const targetHash = routeToHash(nextRoute);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
  }, []);
  const [showSceneCurtain, setShowSceneCurtain] = useState(false);
  const sceneTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHashChange = (): void => {
      setRouteIntent(parseRouteHash(window.location.hash));
    };
    window.addEventListener("hashchange", onHashChange);
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const targetHash = routeToHash(view);
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, "", targetHash);
    }
  }, [view]);

  // ─── UI scale & lang: sync attributes to <html> ─────────
  const uiScale = useSettingsStore((s) => s.uiScale);
  const language = useSettingsStore((s) => s.language);
  const isProgressLoaded = useProgressStore((s) => s.isLoaded);
  const loadProgressSessions = useProgressStore((s) => s.loadSessions);
  useEffect(() => {
    document.documentElement.setAttribute("data-ui-scale", uiScale);
  }, [uiScale]);
  useEffect(() => {
    document.documentElement.lang = language === "zh-TW" ? "zh-Hant" : "en";
  }, [language]);

  useEffect(() => {
    if (isProgressLoaded) return;
    void loadProgressSessions();
  }, [isProgressLoaded, loadProgressSessions]);

  // Guard against unintended scroll on .app-shell — ambient pseudo-elements
  // extend past the viewport (right: -12vw), inflating scrollWidth. Browser
  // auto-scroll (focus-into-view) can set scrollLeft, shifting the entire UI.
  // overflow:hidden doesn't prevent this; we reset on any scroll event.
  useEffect(() => {
    const shell = document.querySelector(".app-shell");
    if (!shell) return;
    const resetScroll = (): void => {
      if (shell.scrollLeft !== 0 || shell.scrollTop !== 0) {
        shell.scrollLeft = 0;
        shell.scrollTop = 0;
      }
    };
    shell.addEventListener("scroll", resetScroll, { passive: true });
    return () => shell.removeEventListener("scroll", resetScroll);
  }, []);

  // Sync persisted volume from settings (0-100) → playback store (0-1) on mount.
  // If the user was muted when the app last closed, honour that on startup.
  useEffect(() => {
    const settings = useSettingsStore.getState();
    if (settings.muted) {
      usePlaybackStore.getState().setVolume(0);
    } else {
      usePlaybackStore.getState().setVolume(settings.volume / 100);
    }
  }, []);

  // Core playback stats
  const speed = usePracticeStore((s) => s.speed);
  // R2-01 fix: Close drawer with Escape using capture phase + stopPropagation.
  // This ensures the drawer Escape takes priority over the global keyboard
  // shortcut Escape handler, preventing both "close drawer" AND "pause playback"
  // from firing on the same keypress.
  useEffect(() => {
    if (!showPlaybackDrawer) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      event.stopPropagation();
      setShowPlaybackDrawer(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [showPlaybackDrawer]);

  // ─── Phase 7: Sheet Music ──────────────────────────────
  const displayMode = usePracticeStore((s) => s.displayMode);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  const [activeNotes, setActiveNotes] = useState<Set<number>>(EMPTY_NOTE_SET);
  const midiActiveNotes = useMidiDeviceStore((s) => s.activeNotes);

  // ── Practice mode: transient hit/miss sets for PianoKeyboard CSS animations ──
  const [hitNotes, setHitNotes] = useState<Set<number>>(EMPTY_NOTE_SET);
  const [missedNotes, setMissedNotes] = useState<Set<number>>(EMPTY_NOTE_SET);
  const hitTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const missTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // R2-01 fix: Shared helper for transient note highlight state.
  // Mutates the Set in place (same reference trick) to avoid creating a new
  // Set on every hit/miss. React re-renders via forced state identity change.
  const addTransientNote = useCallback(
    (
      midi: number,
      setter: React.Dispatch<React.SetStateAction<Set<number>>>,
      timers: Map<number, ReturnType<typeof setTimeout>>,
      durationMs: number,
    ) => {
      setter((prev) => {
        // Only create a new Set if the note isn't already present
        if (prev.has(midi)) return prev;
        const next = new Set(prev);
        next.add(midi);
        return next;
      });
      const existing = timers.get(midi);
      if (existing) clearTimeout(existing);
      timers.set(
        midi,
        setTimeout(() => {
          timers.delete(midi);
          setter((prev) => {
            if (!prev.has(midi)) return prev;
            const next = new Set(prev);
            next.delete(midi);
            return next;
          });
        }, durationMs),
      );
    },
    [],
  );

  const addHitNote = useCallback(
    (midi: number) =>
      addTransientNote(midi, setHitNotes, hitTimersRef.current, 250),
    [addTransientNote],
  );

  const addMissNote = useCallback(
    (midi: number) =>
      addTransientNote(midi, setMissedNotes, missTimersRef.current, 450),
    [addTransientNote],
  );

  const handleActiveNotesChange = useCallback((notes: Set<number>) => {
    setActiveNotes(notes);
  }, []);

  // ── Song completion detection ──
  const [showSongComplete, setShowSongComplete] = useState(false);

  // ─── Phase 4: Audio Engine lifecycle ─────────────────
  const audioRef = useRef<{
    engine: AudioEngine | null;
    scheduler: AudioScheduler | null;
  }>({
    engine: null,
    scheduler: null,
  });
  const recoveryInFlightRef = useRef<Promise<unknown> | null>(null);
  // R1-02 + R1-05: Generation counter to prevent double-start races.
  // Incremented by both song-init and handlePlayAgain; only the latest
  // generation is allowed to call setPlaying(true).
  const playStartGenerationRef = useRef(0);
  const deviceChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const audioOutputSnapshotRef = useRef<string[] | null>(null);
  const triggerRecoveryRef = useRef<(reason: string, error?: unknown) => void>(
    () => {},
  );

  const readAudioOutputSnapshot = useCallback(async (): Promise<
    string[] | null
  > => {
    if (typeof navigator === "undefined") return null;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return null;
    try {
      const devices = await mediaDevices.enumerateDevices();
      return extractAudioOutputIds(devices);
    } catch (err) {
      console.warn("Failed to enumerate media devices:", err);
      return null;
    }
  }, []);

  const rebuildAudioStack = useCallback(
    async (targetSong: NonNullable<typeof song>): Promise<void> => {
      audioRef.current.engine?.setRuntimeErrorHandler(null);
      audioRef.current.scheduler?.dispose();
      audioRef.current.engine?.dispose();

      const { audioCompatibilityMode } = useSettingsStore.getState();
      const engine = new AudioEngine({
        latencyHint: audioCompatibilityMode ? "playback" : "interactive",
        onRuntimeError: (error) => {
          triggerRecoveryRef.current("runtime-device-failure", error);
        },
      });
      const scheduler = new AudioScheduler(engine);

      // Do NOT write audioRef until engine.init() completes — otherwise
      // the subscriber may call scheduler.start() / engine.resume() on a
      // partially initialized engine, producing silent visual playback.
      usePlaybackStore.getState().setAudioStatus("loading");
      try {
        await engine.init();
      } catch (err) {
        // R1-06: Dispose the newly constructed engine if init() fails to
        // avoid orphaned AudioContext / SoundFont resources.
        engine.dispose();
        throw err;
      }

      // Now safe to expose to the rest of the app
      audioRef.current = { engine, scheduler };

      const { muted, noteReleaseMs } = useSettingsStore.getState();
      engine.setVolume(muted ? 0 : usePlaybackStore.getState().volume);
      engine.setReleaseTime(noteReleaseMs / 1000);

      // Rebind metronome to the latest live AudioContext after recovery/rebuild.
      disposeMetronome();
      if (engine.audioContext) {
        initMetronome(engine.audioContext, engine.masterGain ?? undefined);
      }

      scheduler.setSong(targetSong);
      scheduler.setSpeed(usePracticeStore.getState().speed);
      usePlaybackStore.getState().setAudioStatus("ready");
      usePlaybackStore.getState().clearAudioRecovery();
    },
    [],
  );

  // R1-04: Track whether a new recovery trigger arrived during an in-flight
  // recovery. If so, we re-invoke after the current recovery finishes.
  const pendingRecoveryTriggerRef = useRef<{
    reason: string;
    error?: unknown;
  } | null>(null);

  const recoverAudio = useCallback(
    (reason: string, error?: unknown): void => {
      const activeSong = useSongStore.getState().song;
      if (!activeSong) return;

      // R1-04: If recovery is already in flight, stash the trigger so the
      // finally block can re-invoke after the current recovery completes.
      if (recoveryInFlightRef.current) {
        pendingRecoveryTriggerRef.current = { reason, error };
        return;
      }

      if (error) {
        console.error(
          `Audio runtime error (${reason}), rebuilding audio stack:`,
          error,
        );
      }

      // R1-07: Recovery loop logic extracted to engines/audio/runRecoveryLoop.ts
      // for independent testability.
      const recovery = runRecoveryLoop({
        onAttemptStart: (attempt, maxAttempts) => {
          usePlaybackStore.getState().setAudioRecovering(attempt, maxAttempts);
        },
        getSong: () => useSongStore.getState().song,
        rebuild: rebuildAudioStack,
        onSuccess: async () => {
          // Read state AFTER async rebuild to avoid stale snapshot
          const { isPlaying, currentTime } = usePlaybackStore.getState();
          if (isPlaying) {
            const { engine, scheduler } = audioRef.current;
            if (engine && scheduler) {
              scheduler.start(currentTime);
              await engine.resume();

              // R1-03: Restart metronome after successful recovery during
              // playback. The metronome was disposed + reinited inside
              // rebuildAudioStack, but isPlaying never toggled false→true
              // so the playback subscriber's start-check won't fire.
              const metronome = getMetronome();
              if (metronome) {
                const { metronomeEnabled } = useSettingsStore.getState();
                metronome.setEnabled(metronomeEnabled);
                if (metronomeEnabled) {
                  const practiceSpeed = usePracticeStore.getState().speed;
                  const currentSong = useSongStore.getState().song;
                  if (currentSong) {
                    // R1-04 fix: use shared getTempoAtTime utility
                    const { bpm, beatsPerMeasure } = getTempoAtTime(
                      currentTime,
                      currentSong.tempos,
                      currentSong.timeSignatures,
                    );
                    metronome.start(bpm * practiceSpeed, beatsPerMeasure);
                  }
                }
              }
            }
          }
          usePlaybackStore.getState().setAudioRecoverySucceeded();
        },
        onExhausted: () => {
          console.error("Audio recovery failed: all attempts exhausted");
          // R2-03: Clear pending trigger so the finally block doesn't
          // re-launch recovery after exhaustion (phantom recovery).
          pendingRecoveryTriggerRef.current = null;
          const playback = usePlaybackStore.getState();
          playback.setAudioStatus("error");
          playback.setAudioRecoveryFailed(AUDIO_RECOVERY_MAX_ATTEMPTS);
          playback.setPlaying(false);
        },
        onAbort: () => {
          usePlaybackStore.getState().clearAudioRecovery();
        },
      })
        .catch((err) => {
          // R2-02: onSuccess failures propagate here (e.g. engine.resume()
          // threw after a successful rebuild). This is a different failure
          // mode than rebuild exhaustion — the audio stack was rebuilt but
          // is unusable. Set error state without burning retry slots.
          console.error("Audio recovery onSuccess failed:", err);
          const playback = usePlaybackStore.getState();
          playback.setAudioStatus("error");
          playback.setAudioRecoveryFailed(1);
          playback.setPlaying(false);
          // Clear pending trigger — don't retry on a broken audio stack
          pendingRecoveryTriggerRef.current = null;
        })
        .finally(() => {
          recoveryInFlightRef.current = null;

          // R1-04 + R2-03: If a new error arrived during recovery,
          // re-invoke now. The pending ref is cleared by onExhausted
          // and onSuccess-catch, so this only fires on success/abort.
          const pending = pendingRecoveryTriggerRef.current;
          if (pending) {
            pendingRecoveryTriggerRef.current = null;
            // Use queueMicrotask to avoid synchronous recursion stacking frames.
            queueMicrotask(() => {
              triggerRecoveryRef.current(pending.reason, pending.error);
            });
          }
        });

      recoveryInFlightRef.current = recovery;
    },
    [rebuildAudioStack],
  );

  useEffect(() => {
    triggerRecoveryRef.current = recoverAudio;
  }, [recoverAudio]);

  // Manual retry from UI (TransportBar "Retry" button)
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      if (state.audioRecoverySignal !== prev.audioRecoverySignal) {
        triggerRecoveryRef.current("manual-retry");
      }
    });
    return unsub;
  }, []);

  // Compatibility mode changes require a fresh AudioContext with a new latencyHint.
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.audioCompatibilityMode === prev.audioCompatibilityMode) return;
      if (!useSongStore.getState().song) return;
      triggerRecoveryRef.current("compatibility-mode-change");
    });
    return unsub;
  }, []);

  // Proactively rebuild when output-device topology changes.
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.enumerateDevices) return;

    let disposed = false;

    void readAudioOutputSnapshot().then((snapshot) => {
      if (!disposed) {
        audioOutputSnapshotRef.current = snapshot;
      }
    });

    const onDeviceChange = (): void => {
      if (deviceChangeDebounceRef.current) {
        clearTimeout(deviceChangeDebounceRef.current);
      }
      deviceChangeDebounceRef.current = setTimeout(() => {
        void readAudioOutputSnapshot().then((nextSnapshot) => {
          if (!nextSnapshot || disposed) return;
          const changed = hasAudioOutputChanged(
            audioOutputSnapshotRef.current,
            nextSnapshot,
          );
          audioOutputSnapshotRef.current = nextSnapshot;

          if (!changed) return;
          if (!useSongStore.getState().song) return;
          triggerRecoveryRef.current("media-device-change");
        });
      }, AUDIO_DEVICECHANGE_DEBOUNCE_MS);
    };

    if (mediaDevices.addEventListener) {
      mediaDevices.addEventListener("devicechange", onDeviceChange);
    } else {
      mediaDevices.ondevicechange = onDeviceChange;
    }

    return () => {
      disposed = true;
      if (deviceChangeDebounceRef.current) {
        clearTimeout(deviceChangeDebounceRef.current);
        deviceChangeDebounceRef.current = null;
      }
      if (mediaDevices.removeEventListener) {
        mediaDevices.removeEventListener("devicechange", onDeviceChange);
      } else {
        mediaDevices.ondevicechange = null;
      }
    };
  }, [readAudioOutputSnapshot]);

  // Init audio engine when a song is loaded, then auto-play
  useEffect(() => {
    if (!song) return;

    let cancelled = false;
    // R1-05: Capture a generation number so rapid song switches can't race.
    const generation = ++playStartGenerationRef.current;

    const init = async (): Promise<void> => {
      if (recoveryInFlightRef.current) {
        await recoveryInFlightRef.current;
      }
      if (cancelled) return;

      const { engine, scheduler } = audioRef.current;
      // R3-01 fix: also verify AudioContext.state is usable. After a device
      // change without a WASAPI error, engine.status may be "ready" but the
      // underlying AudioContext could be "closed" or "suspended" indefinitely.
      const ctxHealthy =
        engine?.audioContext?.state === "running" ||
        engine?.audioContext?.state === "suspended";
      if (engine && scheduler && engine.status === "ready" && ctxHealthy) {
        // Engine already healthy, just bind the new song
        scheduler.setSong(song);
        scheduler.setSpeed(usePracticeStore.getState().speed);
        usePlaybackStore.getState().setAudioStatus("ready");
      } else {
        try {
          if (cancelled) return;
          await rebuildAudioStack(song);
        } catch (err) {
          if (cancelled) return;
          console.error("Audio init failed:", err);
          usePlaybackStore.getState().setAudioStatus("error");
          return; // Don't auto-play on error
        }
      }

      // R1-02 + R1-05: Only auto-play if this is still the latest generation.
      // A concurrent song switch or handlePlayAgain may have bumped the counter,
      // in which case we yield to the newer initiator.
      if (!cancelled && playStartGenerationRef.current === generation) {
        usePlaybackStore.getState().setPlaying(true);
      }
    };

    // Apply default practice mode/speed from settings whenever a new song loads
    const { defaultMode, defaultSpeed } = useSettingsStore.getState();
    usePracticeStore.getState().setMode(defaultMode);
    usePracticeStore.getState().setSpeed(defaultSpeed);

    void init();

    return () => {
      cancelled = true;
    };
  }, [song, rebuildAudioStack]);

  // Sync playback state → AudioScheduler
  const seekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      const { engine, scheduler } = audioRef.current;
      if (!engine || !scheduler) return;

      // Volume sync
      if (state.volume !== prev.volume) {
        engine.setVolume(state.volume);
      }

      // Play / pause
      if (state.isPlaying && !prev.isPlaying) {
        // Start scheduler synchronously so the ticker loop gets valid
        // audioTime immediately. AudioContext.resume() can happen in the
        // background — ctx.currentTime is valid (just frozen) while
        // suspended, and the math (currentTime - startAudioTime + offset)
        // still works once it unfreezes.
        scheduler.start(state.currentTime);
        void engine.resume().catch((err) => {
          // R2-02 fix: flush any notes queued during the suspended window
          // to prevent them from firing all at once if a subsequent resume
          // succeeds during recovery.
          engine.allNotesOff();
          scheduler.stop();
          triggerRecoveryRef.current("resume-failed", err);
        });
      } else if (!state.isPlaying && prev.isPlaying) {
        scheduler.stop();
      }

      // Seek detection while playing (user dragged slider → large time jump)
      // Only check forward time movement — backward jumps are intentional (loop/seek)
      if (
        state.isPlaying &&
        prev.isPlaying &&
        state.currentTime >= prev.currentTime
      ) {
        const audioTime = scheduler.getCurrentTime();
        if (
          audioTime !== null &&
          Math.abs(state.currentTime - audioTime) > 0.5
        ) {
          if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
          seekTimeoutRef.current = setTimeout(() => {
            scheduler.seek(usePlaybackStore.getState().currentTime);
            seekTimeoutRef.current = null;
          }, 50);
        }
      }

      // Seek while paused (e.g. reset / skip-back button): seekVersion bumps
      // without a play/pause transition, so we need to explicitly tell the
      // scheduler about the new position.
      if (!state.isPlaying && state.seekVersion !== prev.seekVersion) {
        scheduler.seek(state.currentTime);
      }
    });
    return () => {
      unsub();
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
    };
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    const hitTimers = hitTimersRef.current;
    const missTimers = missTimersRef.current;
    return () => {
      audioRef.current.engine?.setRuntimeErrorHandler(null);
      audioRef.current.scheduler?.dispose();
      audioRef.current.engine?.dispose();
      if (deviceChangeDebounceRef.current) {
        clearTimeout(deviceChangeDebounceRef.current);
        deviceChangeDebounceRef.current = null;
      }
      if (dragErrorTimerRef.current) clearTimeout(dragErrorTimerRef.current);
      for (const t of hitTimers.values()) clearTimeout(t);
      for (const t of missTimers.values()) clearTimeout(t);
      disposeMetronome();
      triggerRecoveryRef.current = () => {};
    };
  }, []);

  // Callback for FallingNotesCanvas to sync visual with audio time
  const getAudioCurrentTime = useCallback((): number | null => {
    return audioRef.current.scheduler?.getCurrentTime() ?? null;
  }, []);

  // ─── Phase 6.5: Startup wiring — initAutoSave ──────────
  // Subscribe to playback state transitions to auto-save session records on stop.
  useEffect(() => {
    const cleanup = initAutoSave();
    return cleanup;
  }, []);

  // R1-03 fix: Daily practice time tracking consolidated into initAutoSave()
  // in useProgressStore.ts — single timestamp source eliminates duplication.

  // ─── Song completion detection ─────────────────────────
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      if (!state.isPlaying && prev.isPlaying && state.songEndedNaturally) {
        setShowPlaybackDrawer(false);
        setShowSongComplete(true);
      }
    });
    return unsub;
  }, []);

  const handleExitPlayback = useCallback(() => {
    setShowSongComplete(false);
    useSongStore.getState().clearSong();
    usePlaybackStore.getState().reset();
    applyRoute("menu");
  }, [applyRoute]);

  const handlePlayAgain = useCallback(() => {
    setShowSongComplete(false);
    // R1-02: Bump the generation counter so any in-flight song-init auto-play
    // is invalidated before we issue our own setPlaying(true).
    const generation = ++playStartGenerationRef.current;
    usePlaybackStore.getState().reset();
    usePracticeStore.getState().resetScore();
    // Auto-start playback so the child doesn't need to press play again.
    // Using rAF ensures reset()'s isPlaying=false propagates through
    // subscribers before we set isPlaying=true, giving a clean transition.
    requestAnimationFrame(() => {
      // R2-04: Use generation counter (not isPlaying) to guard against
      // concurrent song-init errors that may have set isPlaying=false
      // within the rAF delay window.
      if (playStartGenerationRef.current === generation) {
        usePlaybackStore.getState().setPlaying(true);
      }
    });
  }, []);

  const handleSongCompleteBack = useCallback(() => {
    setShowSongComplete(false);
    handleExitPlayback();
  }, [handleExitPlayback]);

  // ─── Phase 6.5: Startup wiring — muted setting ─────────
  // Sync the persisted muted setting to the audio engine whenever it changes.
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.muted === prev.muted) return;
      const { engine } = audioRef.current;
      if (!engine) return;
      engine.setVolume(state.muted ? 0 : usePlaybackStore.getState().volume);
    });
    return unsub;
  }, []);

  // Sync note release time setting to the audio engine whenever it changes.
  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.noteReleaseMs === prev.noteReleaseMs) return;
      const { engine } = audioRef.current;
      if (!engine) return;
      engine.setReleaseTime(state.noteReleaseMs / 1000);
    });
    return unsub;
  }, []);

  // ─── MIDI CC64 (sustain pedal) → AudioEngine ──────────
  // Wire the sustain pedal CC message from the MIDI parser to the audio engine.
  useEffect(() => {
    setMidiCCHandler((cc, value) => {
      if (cc === 64) {
        const { engine } = audioRef.current;
        if (!engine) return;
        if (value >= 64) {
          engine.sustainOn();
        } else {
          engine.sustainOff();
        }
      }
    });
    return () => setMidiCCHandler(null);
  }, []);

  // ─── Phase 6: Practice Engine lifecycle (extracted to hook) ──
  // R3-003: Speed -> AudioScheduler sync is now inside usePracticeLifecycle
  // to avoid duplicate subscribers.
  // R3-02 fix: use ref for callback stability — avoids re-subscribe when
  // addHitNote/addMissNote references change (fragile dependency chain)
  const practiceCallbacksRef = useRef({
    onHitNote: addHitNote,
    onMissNote: addMissNote,
  });
  practiceCallbacksRef.current = {
    onHitNote: addHitNote,
    onMissNote: addMissNote,
  };
  const practiceCallbacks = useMemo(
    () => ({
      onHitNote: (midi: number) => practiceCallbacksRef.current.onHitNote(midi),
      onMissNote: (midi: number) =>
        practiceCallbacksRef.current.onMissNote(midi),
    }),
    [],
  );
  const { handleNoteRendererReady, noteRendererRef } = usePracticeLifecycle(
    song,
    audioRef,
    practiceCallbacks,
  );
  // ─── End Phase 6 ─────────────────────────────────────

  // ─── Phase 6.5: Startup wiring — showFallingNoteLabels ─
  // Sync the falling note label setting to NoteRenderer whenever it changes.
  const showFallingNoteLabels = useSettingsStore(
    (s) => s.showFallingNoteLabels,
  );
  const showNoteLabels = useSettingsStore((s) => s.showNoteLabels);
  const compactKeyLabels = useSettingsStore((s) => s.compactKeyLabels);
  const kidMode = useSettingsStore((s) => s.kidMode);
  useEffect(() => {
    if (noteRendererRef.current) {
      noteRendererRef.current.showNoteLabels = showFallingNoteLabels;
      noteRendererRef.current.keySig = song?.keySignatures?.[0]?.key ?? 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- noteRendererRef is stable; initial sync handled in handleNoteRendererReadyWithSync
  }, [showFallingNoteLabels, song]);
  // Wrap the practice lifecycle callback so we also sync settings on init.
  // The useEffect above won't re-fire when the ref is first assigned (ref
  // identity is stable), so we eagerly apply the setting here.
  const handleNoteRendererReadyWithSync = useCallback(
    (renderer: Parameters<typeof handleNoteRendererReady>[0]) => {
      handleNoteRendererReady(renderer);
      renderer.showNoteLabels =
        useSettingsStore.getState().showFallingNoteLabels;
      renderer.keySig =
        useSongStore.getState().song?.keySignatures?.[0]?.key ?? 0;
    },
    [handleNoteRendererReady],
  );
  // ─── End Phase 6.5 ───────────────────────────────────

  const handleOpenFile = useCallback(async (): Promise<void> => {
    if (!window.api?.openMidiFile) return;
    try {
      const result = await window.api.openMidiFile();
      if (result) {
        const parsed = parseMidiFile(result.fileName, result.data);
        loadSong(parsed);
        reset();
        // Save to recent files if we have the full path
        if (result.path) {
          void window.api.saveRecentFile({
            path: result.path,
            name: result.fileName,
            timestamp: Date.now(),
          });
        }
      }
    } catch (e) {
      console.error("Failed to parse MIDI file:", e);
    }
  }, [loadSong, reset]);

  // Load a MIDI file directly by path (used by recent files in MainMenu)
  const handleLoadMidiPath = useCallback(
    async (filePath: string, displayName?: string): Promise<void> => {
      if (!window.api) return;
      try {
        // R1-01 fix: wrap IPC calls with timeout to prevent indefinite hangs
        const result = filePath.startsWith("builtin:")
          ? await withTimeout(
              window.api.loadBuiltinSong(filePath.slice("builtin:".length)),
              10_000,
              "loadBuiltinSong",
            )
          : await withTimeout(
              window.api.loadMidiPath(filePath),
              10_000,
              "loadMidiPath",
            );
        if (result) {
          const parsed = parseMidiFile(result.fileName, result.data);
          if (displayName) parsed.displayName = displayName;
          loadSong(parsed);
          reset();
        }
      } catch (e) {
        console.error("Failed to load MIDI from path:", e);
      }
    },
    [loadSong, reset],
  );

  // ─── Phase 6.5: Mute toggle ────────────────────────────
  // R1-03 fix: toggleMute is a stable module-level function — no wrapper needed
  const handleToggleMute = toggleMute;

  // ─── Phase 6.5: Keyboard shortcuts ─────────────────────
  useKeyboardShortcuts({
    onOpenFile: handleOpenFile,
    onToggleMute: handleToggleMute,
  });

  // ─── Phase 6.5: Drag-and-drop MIDI import ──────────────
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  /** R2-03 fix: shared auto-dismiss helper for drag error messages */
  const DRAG_ERROR_DISMISS_MS = 3000;
  const showDragError = useCallback((msg: string) => {
    setDragError(msg);
    if (dragErrorTimerRef.current) clearTimeout(dragErrorTimerRef.current);
    dragErrorTimerRef.current = setTimeout(
      () => setDragError(null),
      DRAG_ERROR_DISMISS_MS,
    );
  }, []);
  const dragCountRef = useRef(0);
  const dragErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current++;
    setIsDragging(true);
    setDragError(null);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCountRef.current--;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setIsDragging(false);
      setDragError(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCountRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!MIDI_EXTENSIONS.includes(ext)) {
        showDragError(t("app.invalidFileType", { ext }));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const arrayBuf = reader.result as ArrayBuffer;
          const data = Array.from(new Uint8Array(arrayBuf));
          const parsed = parseMidiFile(file.name, data);
          loadSong(parsed);
          reset();
        } catch (err) {
          console.error("Failed to parse dropped MIDI file:", err);
          showDragError(t("app.failedParse"));
        }
      };
      reader.onerror = () => {
        showDragError(t("app.failedRead"));
      };
      reader.readAsArrayBuffer(file);
    },
    [loadSong, reset, t],
  );
  // ─── End Phase 6.5 ─────────────────────────────────────

  const keyboardHeightMap = { normal: 100, large: 130, xlarge: 160 } as const;
  const keyboardHeight = keyboardHeightMap[uiScale];
  const fallingCanvasMinHeight = 200;
  const speedPercent = Math.round(speed * 100);
  const rawBaseBpm =
    song?.tempos && song.tempos.length > 0 ? song.tempos[0].bpm : null;
  const rawEffectiveBpm =
    rawBaseBpm !== null ? Math.max(1, rawBaseBpm * speed) : null;
  /** Format BPM: show one decimal place only if non-integer */
  const formatBpm = (bpm: number): string =>
    bpm % 1 === 0 ? String(bpm) : bpm.toFixed(1);
  const effectiveBpm =
    rawEffectiveBpm !== null ? formatBpm(rawEffectiveBpm) : null;

  useEffect(() => {
    const token = `${view}:${song?.fileName ?? ""}`;
    if (sceneTokenRef.current === null) {
      sceneTokenRef.current = token;
      return;
    }
    if (sceneTokenRef.current === token) return;

    sceneTokenRef.current = token;
    const raf = requestAnimationFrame(() => setShowSceneCurtain(true));
    const timer = setTimeout(() => setShowSceneCurtain(false), 520);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [view, song?.fileName]);

  return (
    <div
      className="app-shell flex h-screen flex-col"
      style={{ color: "var(--color-text)" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-body"
        style={{ background: "var(--color-accent)", color: "#fff" }}
      >
        {t("app.skipToContent")}
      </a>
      {showSceneCurtain && <div className="scene-curtain" />}

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="region"
          aria-label="Drop zone"
          style={{
            background: "color-mix(in srgb, var(--color-bg) 55%, transparent)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="rounded-3xl px-14 py-10 text-center subtle-shadow-md animate-drop-pulse"
            style={{
              background:
                "color-mix(in srgb, var(--color-surface) 92%, transparent)",
              border: "3px dashed var(--color-accent)",
            }}
          >
            <div className="text-5xl mb-3 select-none">{"\u{1F3B5}"}</div>
            <p
              className="text-xl font-bold font-display"
              style={{ color: "var(--color-text)" }}
            >
              {t("app.dropMidi")}
            </p>
            <p
              className="text-sm mt-2"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("app.supportedFormats")}
            </p>
          </div>
        </div>
      )}

      {/* Song complete celebration overlay */}
      {showSongComplete && (
        <SongCompleteOverlay
          onPlayAgain={handlePlayAgain}
          onBackToLibrary={handleSongCompleteBack}
        />
      )}

      {/* Drag error toast */}
      {dragError && (
        <div
          role="alert"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-body subtle-shadow"
          style={{
            background:
              "color-mix(in srgb, var(--color-error) 55%, var(--color-surface))",
            color: "var(--color-text)",
            border:
              "1px solid color-mix(in srgb, var(--color-error) 30%, var(--color-border))",
          }}
        >
          {dragError}
        </div>
      )}

      <main id="main-content" className="flex-1 min-h-0 flex flex-col">
        {/* View: Main Menu */}
        {!song && view === "menu" && (
          <>
            <MainMenu
              onStartPractice={() => applyRoute("library")}
              onOpenSettings={() => setShowMenuSettings(true)}
              onSelectRecent={(file) =>
                void handleLoadMidiPath(file.path, file.name)
              }
            />
            {showMenuSettings && (
              <SettingsPanel
                inline
                onClose={() => setShowMenuSettings(false)}
              />
            )}
          </>
        )}

        {/* View: Song Library */}
        {!song && view === "library" && (
          <div
            key="library"
            className="flex-1 min-h-0 flex flex-col animate-page-enter"
          >
            <SongLibrary
              onOpenFile={handleOpenFile}
              onBack={() => applyRoute("menu")}
            />
          </div>
        )}

        {/* View: Playback */}
        {song && (
          <div
            key="playback"
            className="flex-1 min-h-0 flex flex-col animate-page-enter overflow-hidden px-3 pb-3 pt-3"
            data-testid="playback-view"
          >
            <div
              className="surface-panel subtle-shadow px-2.5 py-2 mb-2"
              style={{
                borderRadius: "1.1rem",
              }}
              data-testid="playback-header-panel"
            >
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                <div
                  className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden"
                  data-testid="playback-title-meta-row"
                >
                  <img
                    src={appIcon}
                    alt=""
                    className="hidden shrink-0 sm:inline"
                    style={{ width: 22, height: 22, borderRadius: 5 }}
                  />
                  <span className="kicker-label hidden shrink-0 text-[11px] sm:inline">
                    {t("app.subtitle")}
                  </span>
                  <h2
                    className="min-w-0 max-w-[min(46vw,420px)] truncate text-[1.02rem] leading-tight font-semibold font-body sm:max-w-[min(40vw,420px)]"
                    data-testid="playback-song-title"
                  >
                    {song.displayName ?? song.fileName}
                  </h2>

                  <div
                    className="[-ms-overflow-style:none] [scrollbar-width:none] flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap sm:overflow-hidden"
                    data-testid="playback-header-chips"
                  >
                    <span className="control-chip playback-header-chip shrink-0">
                      {song.tracks.length}{" "}
                      {song.tracks.length > 1
                        ? t("song.tracks")
                        : t("song.track")}
                    </span>
                    <span className="control-chip playback-header-chip shrink-0">
                      {song.noteCount} {t("song.notes")}
                    </span>
                    <span className="control-chip playback-header-chip tabular-nums shrink-0">
                      {speedPercent}%
                    </span>
                    {effectiveBpm !== null && (
                      <span className="control-chip playback-header-chip tabular-nums shrink-0">
                        {effectiveBpm} BPM
                      </span>
                    )}
                  </div>
                </div>

                <div
                  className="flex shrink-0 self-end items-center gap-1 sm:self-auto"
                  data-testid="playback-header-actions"
                >
                  <button
                    onClick={() => setShowPlaybackDrawer(true)}
                    className="btn-surface-themed flex items-center gap-1 rounded-lg font-body cursor-pointer px-2 py-[3px] text-[10px]"
                    data-testid="playback-drawer-trigger"
                  >
                    <PanelRightOpen size={13} />
                    <span className="hidden sm:inline">
                      {t("settings.title")}
                    </span>
                  </button>
                  <button
                    onClick={handleExitPlayback}
                    className="btn-surface-themed flex items-center gap-1 rounded-lg font-body cursor-pointer px-2 py-[3px] text-[10px]"
                    data-testid="playback-back-to-library"
                  >
                    <ArrowLeft size={13} />
                    <span className="hidden sm:inline">
                      {t("song.backToLibrary")}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {showPlaybackDrawer && (
              <div
                className="app-overlay-backdrop"
                onClick={() => setShowPlaybackDrawer(false)}
                data-testid="playback-settings-drawer-backdrop"
              >
                <aside
                  className="app-side-drawer"
                  onClick={(e) => e.stopPropagation()}
                  role="complementary"
                  aria-label={t("settings.title")}
                  data-testid="playback-settings-drawer"
                >
                  <div className="app-side-drawer-header">
                    <span className="kicker-label">{t("settings.title")}</span>
                    <button
                      onClick={() => setShowPlaybackDrawer(false)}
                      className="btn-surface-themed w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                      aria-label={t("settings.close")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="app-side-drawer-body">
                    <section className="app-side-section">
                      <DisplayModeToggle />
                    </section>
                    {/* Advanced sections hidden in kid mode to reduce clutter */}
                    {!kidMode && (
                      <>
                        <section className="app-side-section">
                          <DeviceSelector />
                        </section>
                        <section className="app-side-section">
                          <SettingsPanel />
                        </section>
                      </>
                    )}
                  </div>
                </aside>
              </div>
            )}

            {/* Main display area: sheet music / falling notes / both */}
            <div
              className={`workspace-frame ${isPlaying ? "workspace-frame-live" : ""} flex-1 relative flex flex-col min-h-0 surface-panel overflow-hidden`}
            >
              {/* Sheet music panel */}
              <div
                className="relative"
                style={{
                  display: displayMode === "falling" ? "none" : "block",
                  ...(displayMode === "split"
                    ? {
                        flex: "0 0 30%",
                        minHeight: 140,
                        maxHeight: "40%",
                        borderBottom: "1px solid var(--color-border, #e0e0e0)",
                        overflow: "auto",
                      }
                    : {}),
                }}
              >
                <SheetMusicPanelOSMD
                  song={song}
                  mode={displayMode}
                  getAudioCurrentTime={getAudioCurrentTime}
                />
              </div>

              {/* Falling notes canvas — always mounted so PixiJS ticker keeps
                running (WaitMode relies on it). Hidden via off-screen
                positioning in sheet mode — display:none would stop the
                PixiJS RAF loop and break WaitMode's pause gate. */}
              <div
                data-testid="falling-notes-panel"
                className="flex-1 min-h-0 relative flex flex-col"
                style={
                  displayMode === "sheet"
                    ? {
                        position: "absolute",
                        width: 0,
                        height: 0,
                        overflow: "hidden" as const,
                        pointerEvents: "none" as const,
                      }
                    : {}
                }
              >
                <FallingNotesCanvas
                  onActiveNotesChange={handleActiveNotesChange}
                  getAudioCurrentTime={getAudioCurrentTime}
                  onNoteRendererReady={handleNoteRendererReadyWithSync}
                  minHeight={fallingCanvasMinHeight}
                  firstNote={firstNote}
                  lastNote={lastNote}
                />
              </div>
              <ScoreOverlay />
            </div>

            {/* Transport bar */}
            <TransportBar />

            {/* Practice toolbar */}
            <PracticeToolbar />

            {/* Piano keyboard */}
            <PianoKeyboard
              activeNotes={activeNotes}
              midiActiveNotes={midiActiveNotes}
              hitNotes={hitNotes}
              missedNotes={missedNotes}
              height={keyboardHeight}
              showLabels={showNoteLabels}
              compactLabels={compactKeyLabels}
              firstNote={firstNote}
              lastNote={lastNote}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

