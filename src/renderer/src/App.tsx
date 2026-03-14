import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ArrowLeft, PanelRightOpen, X } from "lucide-react";
import appIcon from "../../../docs/figure/Rexiano_icon.png";
import { parseMidiFile } from "./engines/midi/MidiFileParser";
import { useSongStore } from "./stores/useSongStore";
import { usePlaybackStore } from "./stores/usePlaybackStore";
import { useProgressStore, initAutoSave } from "./stores/useProgressStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import {
  initMetronome,
  disposeMetronome,
} from "./engines/metronome/metronomeManager";
import { AudioEngine } from "./engines/audio/AudioEngine";
import { AudioScheduler } from "./engines/audio/AudioScheduler";
import {
  AUDIO_DEVICECHANGE_DEBOUNCE_MS,
  AUDIO_RECOVERY_MAX_ATTEMPTS,
  computeRecoveryBackoffMs,
  delay,
  extractAudioOutputIds,
  hasAudioOutputChanged,
} from "./engines/audio/recoveryUtils";
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
import { useTranslation } from "./i18n/useTranslation";
import { SheetMusicPanel } from "./features/sheetMusic/SheetMusicPanel";
import { SheetMusicPanelOSMD } from "./features/sheetMusic/SheetMusicPanelOSMD";
import { DisplayModeToggle } from "./features/sheetMusic/DisplayModeToggle";
import { useSheetMusicRenderer } from "./features/sheetMusic/useSheetMusicRenderer";
import { convertToNotation } from "./features/sheetMusic/MidiToNotation";
import { usePracticeStore } from "./stores/usePracticeStore";
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

function App(): React.JSX.Element {
  const { t } = useTranslation();
  const song = useSongStore((s) => s.song);
  const loadSong = useSongStore((s) => s.loadSong);
  const reset = usePlaybackStore((s) => s.reset);
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

  // ─── UI scale: sync data attribute to <html> ─────────
  const uiScale = useSettingsStore((s) => s.uiScale);
  const isProgressLoaded = useProgressStore((s) => s.isLoaded);
  const loadProgressSessions = useProgressStore((s) => s.loadSessions);
  useEffect(() => {
    document.documentElement.setAttribute("data-ui-scale", uiScale);
  }, [uiScale]);

  useEffect(() => {
    if (isProgressLoaded) return;
    void loadProgressSessions();
  }, [isProgressLoaded, loadProgressSessions]);

  // Sync persisted volume from settings (0-100) → playback store (0-1) on mount
  useEffect(() => {
    const persistedVolume = useSettingsStore.getState().volume;
    usePlaybackStore.getState().setVolume(persistedVolume / 100);
  }, []);

  // Core playback stats
  const speed = usePracticeStore((s) => s.speed);
  // Close drawer with Escape.
  useEffect(() => {
    if (!showPlaybackDrawer) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      setShowPlaybackDrawer(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPlaybackDrawer]);

  // ─── Phase 7: Sheet Music ──────────────────────────────
  const displayMode = usePracticeStore((s) => s.displayMode);
  const { renderer: sheetRenderer } = useSheetMusicRenderer();
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  const notationData = useMemo(() => {
    if (!song) return null;
    const flattened = song.tracks.flatMap((track, idx) =>
      track.notes.map((note) => ({ note, trackIndex: idx })),
    );
    const allNotes = flattened.map((x) => x.note);
    const noteTrackIndices = flattened.map((x) => x.trackIndex);
    const tempos =
      song.tempos.length > 0 ? song.tempos : [{ time: 0, bpm: 120 }];
    const primaryTimeSignature = song.timeSignatures[0];
    const timeSigTop = primaryTimeSignature?.numerator ?? 4;
    const timeSigBottom = primaryTimeSignature?.denominator ?? 4;
    const keySig = song.keySignatures?.[0]?.key ?? 0;
    return convertToNotation(
      allNotes,
      tempos,
      480,
      timeSigTop,
      timeSigBottom,
      keySig,
      0,
      song.tracks.length,
      song.expressions,
      song.timeSignatures,
      noteTrackIndices,
    );
  }, [song]);

  // ─── End Phase 7 ──────────────────────────────────────

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const midiActiveNotes = useMidiDeviceStore((s) => s.activeNotes);

  // ── Practice mode: transient hit/miss sets for PianoKeyboard CSS animations ──
  const [hitNotes, setHitNotes] = useState<Set<number>>(new Set());
  const [missedNotes, setMissedNotes] = useState<Set<number>>(new Set());
  const hitTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const missTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const addHitNote = useCallback((midi: number) => {
    setHitNotes((prev) => new Set(prev).add(midi));
    const existing = hitTimersRef.current.get(midi);
    if (existing) clearTimeout(existing);
    hitTimersRef.current.set(
      midi,
      setTimeout(() => {
        hitTimersRef.current.delete(midi);
        setHitNotes((prev) => {
          const next = new Set(prev);
          next.delete(midi);
          return next;
        });
      }, 250),
    );
  }, []);

  const addMissNote = useCallback((midi: number) => {
    setMissedNotes((prev) => new Set(prev).add(midi));
    const existing = missTimersRef.current.get(midi);
    if (existing) clearTimeout(existing);
    missTimersRef.current.set(
      midi,
      setTimeout(() => {
        missTimersRef.current.delete(midi);
        setMissedNotes((prev) => {
          const next = new Set(prev);
          next.delete(midi);
          return next;
        });
      }, 450),
    );
  }, []);

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
  const recoveryInFlightRef = useRef<Promise<void> | null>(null);
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
      await engine.init();

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

  const recoverAudio = useCallback(
    (reason: string, error?: unknown): void => {
      const activeSong = useSongStore.getState().song;
      if (!activeSong || recoveryInFlightRef.current) return;

      if (error) {
        console.error(
          `Audio runtime error (${reason}), rebuilding audio stack:`,
          error,
        );
      }

      const recovery = (async () => {
        for (
          let attempt = 1;
          attempt <= AUDIO_RECOVERY_MAX_ATTEMPTS;
          attempt++
        ) {
          usePlaybackStore
            .getState()
            .setAudioRecovering(attempt, AUDIO_RECOVERY_MAX_ATTEMPTS);

          try {
            const liveSong = useSongStore.getState().song;
            if (!liveSong) {
              usePlaybackStore.getState().clearAudioRecovery();
              return;
            }

            await rebuildAudioStack(liveSong);

            // Read state AFTER async rebuild to avoid stale snapshot
            const { isPlaying, currentTime } = usePlaybackStore.getState();
            if (isPlaying) {
              const { engine, scheduler } = audioRef.current;
              if (engine && scheduler) {
                scheduler.start(currentTime);
                await engine.resume();
              }
            }
            usePlaybackStore.getState().setAudioRecoverySucceeded();
            return;
          } catch (err) {
            console.error(
              `Audio recovery attempt ${attempt}/${AUDIO_RECOVERY_MAX_ATTEMPTS} failed:`,
              err,
            );
            if (attempt >= AUDIO_RECOVERY_MAX_ATTEMPTS) {
              throw err;
            }
            await delay(computeRecoveryBackoffMs(attempt));
          }
        }
      })()
        .catch((err) => {
          console.error("Audio recovery failed:", err);
          const playback = usePlaybackStore.getState();
          playback.setAudioStatus("error");
          playback.setAudioRecoveryFailed(AUDIO_RECOVERY_MAX_ATTEMPTS);
          playback.setPlaying(false);
        })
        .finally(() => {
          recoveryInFlightRef.current = null;
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

    const init = async (): Promise<void> => {
      if (recoveryInFlightRef.current) {
        await recoveryInFlightRef.current;
      }
      if (cancelled) return;

      const { engine, scheduler } = audioRef.current;
      if (engine && scheduler && engine.status === "ready") {
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

      // Auto-play: start playback immediately after audio is ready
      // (matches Synthesia UX — selecting a song begins playback)
      if (!cancelled) {
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

  // ─── Daily practice time tracking ──────────────────────
  // Track elapsed playback time and add to daily progress when playback stops.
  useEffect(() => {
    let playStartTime: number | null = null;
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      if (state.isPlaying && !prev.isPlaying) {
        playStartTime = Date.now();
      }
      if (!state.isPlaying && prev.isPlaying && playStartTime !== null) {
        const elapsed = Date.now() - playStartTime;
        if (elapsed > 1000) {
          useProgressStore.getState().addPracticeTime(elapsed);
        }
        playStartTime = null;
      }
    });
    return unsub;
  }, []);

  // ─── Song completion detection ─────────────────────────
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      if (!state.isPlaying && prev.isPlaying && state.songEndedNaturally) {
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
    usePlaybackStore.getState().reset();
    usePracticeStore.getState().resetScore();
    // Auto-start playback so the child doesn't need to press play again
    requestAnimationFrame(() => {
      usePlaybackStore.getState().setPlaying(true);
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
  const practiceCallbacks = useMemo(
    () => ({ onHitNote: addHitNote, onMissNote: addMissNote }),
    [addHitNote, addMissNote],
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
    async (filePath: string): Promise<void> => {
      if (!window.api) return;
      try {
        const result = filePath.startsWith("builtin:")
          ? await window.api.loadBuiltinSong(filePath.slice("builtin:".length))
          : await window.api.loadMidiPath(filePath);
        if (result) {
          const parsed = parseMidiFile(result.fileName, result.data);
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
  const muteRef = useRef({
    prevVolume: usePlaybackStore.getState().volume || 0.8,
  });
  const handleToggleMute = useCallback(() => {
    const pb = usePlaybackStore.getState();
    if (pb.volume > 0) {
      muteRef.current.prevVolume = pb.volume;
      pb.setVolume(0);
    } else {
      pb.setVolume(muteRef.current.prevVolume || 0.8);
    }
  }, []);

  // ─── Phase 6.5: Keyboard shortcuts ─────────────────────
  useKeyboardShortcuts({
    onOpenFile: handleOpenFile,
    onToggleMute: handleToggleMute,
  });

  // ─── Phase 6.5: Drag-and-drop MIDI import ──────────────
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
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
        setDragError(t("app.invalidFileType", { ext }));
        if (dragErrorTimerRef.current) clearTimeout(dragErrorTimerRef.current);
        dragErrorTimerRef.current = setTimeout(() => setDragError(null), 3000);
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
          setDragError(t("app.failedParse"));
          if (dragErrorTimerRef.current)
            clearTimeout(dragErrorTimerRef.current);
          dragErrorTimerRef.current = setTimeout(
            () => setDragError(null),
            3000,
          );
        }
      };
      reader.onerror = () => {
        setDragError(t("app.failedRead"));
        if (dragErrorTimerRef.current) clearTimeout(dragErrorTimerRef.current);
        dragErrorTimerRef.current = setTimeout(() => setDragError(null), 3000);
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
      {showSceneCurtain && <div className="scene-curtain" />}

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="region"
          aria-label="Drop zone"
          style={{
            background: "rgba(6, 10, 12, 0.55)",
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
            background: "color-mix(in srgb, #dc2626 55%, var(--color-surface))",
            color: "var(--color-text)",
            border:
              "1px solid color-mix(in srgb, #dc2626 30%, var(--color-border))",
          }}
        >
          {dragError}
        </div>
      )}

      {/* View: Main Menu */}
      {!song && view === "menu" && (
        <>
          <MainMenu
            onStartPractice={() => applyRoute("library")}
            onOpenSettings={() => setShowMenuSettings(true)}
            onSelectRecent={(file) => void handleLoadMidiPath(file.path)}
          />
          {showMenuSettings && (
            <SettingsPanel inline onClose={() => setShowMenuSettings(false)} />
          )}
        </>
      )}

      {/* View: Song Library */}
      {!song && view === "library" && (
        <div key="library" className="flex-1 flex flex-col animate-page-enter">
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
          className="flex-1 min-h-0 flex flex-col animate-page-enter overflow-y-auto overflow-x-hidden px-3 pb-3 pt-3"
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
                  {song.fileName}
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
              {sheetRenderer === "osmd" ? (
                <SheetMusicPanelOSMD song={song} mode={displayMode} />
              ) : (
                <SheetMusicPanel
                  notationData={notationData}
                  mode={displayMode}
                />
              )}
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
          />
        </div>
      )}
    </div>
  );
}

export default App;
