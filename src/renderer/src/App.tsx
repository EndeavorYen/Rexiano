import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ArrowLeft, BarChart3, PanelRightOpen, X } from "lucide-react";
import { parseMidiFile } from "./engines/midi/MidiFileParser";
import { useSongStore } from "./stores/useSongStore";
import { usePlaybackStore } from "./stores/usePlaybackStore";
import {
  useProgressStore,
  initAutoSave,
  deriveSongId,
} from "./stores/useProgressStore";
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
import { InsightsPanel } from "./features/insights/InsightsPanel";
import { WeakSpotAnalyzer } from "./features/insights/WeakSpotAnalyzer";
import type { SessionSummary } from "./features/insights/WeakSpotAnalyzer";
import { useMidiDeviceStore, setMidiCCHandler } from "./stores/useMidiDeviceStore";
import { usePracticeLifecycle } from "./features/practice/usePracticeLifecycle";
import { PracticeToolbar } from "./features/practice/PracticeToolbar";
import { ScoreOverlay } from "./features/practice/ScoreOverlay";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTranslation } from "./i18n/useTranslation";
import { SheetMusicPanel } from "./features/sheetMusic/SheetMusicPanel";
import { DisplayModeToggle } from "./features/sheetMusic/DisplayModeToggle";
import { convertToNotation } from "./features/sheetMusic/MidiToNotation";
import { usePracticeStore } from "./stores/usePracticeStore";
import { MainMenu } from "./features/mainMenu/MainMenu";
import { ModeSelectionModal } from "./features/practice/ModeSelectionModal";
import { CelebrationOverlay } from "./features/practice/CelebrationOverlay";
import { CountInOverlay } from "./features/practice/CountInOverlay";
import { StatisticsPage } from "./features/statistics/StatisticsPage";
import { getPracticeEngines } from "./engines/practice/practiceManager";
import { OnboardingGuide } from "./features/onboarding/OnboardingGuide";
import { KeyboardShortcutsHelp } from "./features/settings/KeyboardShortcutsHelp";
import type { PracticeMode } from "@shared/types";
import {
  parseRouteHash,
  resolveRoute,
  routeToHash,
  type AppRoute,
} from "./features/routing/appRoute";

/** Accepted file extensions for drag-and-drop MIDI import */
const MIDI_EXTENSIONS = [".mid", ".midi"];
const CELEBRATION_DURATION_MS = 5000;
const HEADER_ESTIMATED_HEIGHT = 112;
const TRANSPORT_ESTIMATED_HEIGHT = 84;
const TOOLBAR_ESTIMATED_HEIGHT = 72;
const CHROME_VERTICAL_PADDING = 34;
const SPLIT_SHEET_MIN = 168;
const SPLIT_SHEET_MAX = 272;
const SPLIT_SHEET_RATIO = 0.31;
const SPLIT_FALLING_MIN = 72;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const analyzer = new WeakSpotAnalyzer();

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
  const countInBeats = useSettingsStore((s) => s.countInBeats);
  useEffect(() => {
    document.documentElement.setAttribute("data-ui-scale", uiScale);
  }, [uiScale]);

  // ─── Mode selection + count-in + celebration + stats flow ────────
  const [showModeModal, setShowModeModal] = useState(false);
  const [countInActive, setCountInActive] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const mode = usePracticeStore((s) => s.mode);
  const speed = usePracticeStore((s) => s.speed);
  const score = usePracticeStore((s) => s.score);

  // Track wall-clock session start for accurate durationSeconds in stats
  const sessionStartRef = useRef<number>(Date.now());

  // Show mode selection when a new song loads (subscribe pattern avoids
  // calling setState directly in an effect body).
  useEffect(() => {
    return useSongStore.subscribe((state, prev) => {
      if (state.song !== prev.song && state.song) {
        sessionStartRef.current = Date.now();
        setShowModeModal(true);
        setShowCelebration(false);
        setShowStats(false);
      }
    });
  }, []);

  // Detect song end: isPlaying transitions true → false when near end of song.
  useEffect(() => {
    return usePlaybackStore.subscribe((state, prev) => {
      if (prev.isPlaying && !state.isPlaying) {
        const currentSong = useSongStore.getState().song;
        const currentScore = usePracticeStore.getState().score;
        if (
          currentSong &&
          currentScore.totalNotes > 0 &&
          state.currentTime >= currentSong.duration - 0.3
        ) {
          setShowCelebration(true);
          setShowStats(false);
        }
      }
    });
  }, []);

  // End flow: celebration is shown first, then automatically transition to stats.
  useEffect(() => {
    if (!showCelebration) return;
    const timer = setTimeout(() => {
      setShowCelebration(false);
      setShowStats(true);
    }, CELEBRATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showCelebration]);

  const modeSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleModeSelect = useCallback((mode: PracticeMode) => {
    usePracticeStore.getState().setMode(mode);
    setShowModeModal(false);
    if (modeSelectTimerRef.current) clearTimeout(modeSelectTimerRef.current);
    const beats = useSettingsStore.getState().countInBeats;
    if (beats > 0) {
      // Show count-in overlay; playback starts when it completes
      modeSelectTimerRef.current = setTimeout(() => {
        setCountInActive(true);
      }, 150);
    } else {
      modeSelectTimerRef.current = setTimeout(() => {
        usePlaybackStore.getState().setPlaying(true);
      }, 150);
    }
  }, []);

  const handleCountInComplete = useCallback(() => {
    setCountInActive(false);
    usePlaybackStore.getState().setPlaying(true);
  }, []);

  const handlePracticeAgain = useCallback(() => {
    setShowCelebration(false);
    setShowStats(false);
    usePlaybackStore.getState().reset();
    usePracticeStore.getState().resetScore();
    usePracticeStore.getState().setLoopRange(null);
    // Reset WaitMode so notes are re-judged from scratch
    const { waitMode } = getPracticeEngines();
    waitMode?.reset();
    // Re-show mode selection so the player can pick Watch/Wait/Free again
    setShowModeModal(true);
    sessionStartRef.current = Date.now();
  }, []);

  const handleChooseSong = useCallback(() => {
    setShowCelebration(false);
    setShowStats(false);
    useSongStore.getState().clearSong();
    usePlaybackStore.getState().reset();
    applyRoute("menu");
  }, [applyRoute]);
  // ─── End mode/celebration/stats flow ──────────────────

  // ─── Phase 6.5 Sprint 5: Insights Panel ──────────────
  const [showInsights, setShowInsights] = useState(false);
  const sessions = useProgressStore((s) => s.sessions);
  const songId = song ? deriveSongId(song) : "";

  const insight = useMemo(() => {
    if (!songId || sessions.length === 0) return null;
    const summaries: SessionSummary[] = sessions
      .filter((s) => s.songId === songId)
      .map((s) => ({
        songId: s.songId,
        accuracy: s.score.accuracy,
        durationMinutes: s.durationSeconds / 60,
        timestamp: s.timestamp,
        noteResults: new Map(),
      }));
    return analyzer.analyze(songId, summaries);
  }, [songId, sessions]);

  // Close lightweight overlays with Escape without interrupting active flows
  // like mode selection / celebration / statistics.
  useEffect(() => {
    if (!showPlaybackDrawer && !showInsights) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented) return;
      if (showModeModal || showCelebration || showStats) return;
      if (showInsights) {
        event.preventDefault();
        setShowInsights(false);
        return;
      }
      if (showPlaybackDrawer) {
        event.preventDefault();
        setShowPlaybackDrawer(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    showPlaybackDrawer,
    showInsights,
    showModeModal,
    showCelebration,
    showStats,
  ]);

  // ─── Phase 7: Sheet Music ──────────────────────────────
  const displayMode = usePracticeStore((s) => s.displayMode);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  const notationData = useMemo(() => {
    if (!song) return null;
    const allNotes = song.tracks.flatMap((tr) => tr.notes);
    const bpm = song.tempos.length > 0 ? song.tempos[0].bpm : 120;
    const keySig = song.keySignatures?.[0]?.key ?? 0;
    return convertToNotation(allNotes, bpm, 480, 4, 4, keySig);
  }, [song]);

  // ─── End Phase 7 ──────────────────────────────────────

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const midiActiveNotes = useMidiDeviceStore((s) => s.activeNotes);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== "undefined" ? window.innerHeight : 900,
  );
  const [splitFocusPanel, setSplitFocusPanel] = useState<"sheet" | "falling">(
    "sheet",
  );

  const handleActiveNotesChange = useCallback((notes: Set<number>) => {
    setActiveNotes(notes);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = (): void => {
      setViewportHeight(window.innerHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
      audioRef.current = { engine, scheduler };

      usePlaybackStore.getState().setAudioStatus("loading");
      await engine.init();

      const { muted, noteReleaseMs } = useSettingsStore.getState();
      engine.setVolume(muted ? 0 : usePlaybackStore.getState().volume);
      engine.setReleaseTime(noteReleaseMs / 1000);

      // Rebind metronome to the latest live AudioContext after recovery/rebuild.
      disposeMetronome();
      if (engine.audioContext) {
        initMetronome(engine.audioContext);
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

            const { isPlaying, currentTime } = usePlaybackStore.getState();
            await rebuildAudioStack(liveSong);

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

  // Init audio engine when a song is loaded
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
        return;
      }

      try {
        await rebuildAudioStack(song);
      } catch (err) {
        if (cancelled) return;
        console.error("Audio init failed:", err);
        usePlaybackStore.getState().setAudioStatus("error");
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
    return () => {
      audioRef.current.engine?.setRuntimeErrorHandler(null);
      audioRef.current.scheduler?.dispose();
      audioRef.current.engine?.dispose();
      if (deviceChangeDebounceRef.current) {
        clearTimeout(deviceChangeDebounceRef.current);
        deviceChangeDebounceRef.current = null;
      }
      if (dragErrorTimerRef.current) clearTimeout(dragErrorTimerRef.current);
      if (modeSelectTimerRef.current) clearTimeout(modeSelectTimerRef.current);
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

  // ─── Phase 6.5: Startup wiring — speed sync to AudioScheduler ──
  // When practice speed changes, sync the multiplier to the AudioScheduler
  // so audio playback rate matches the visual slow-down.
  useEffect(() => {
    const unsub = usePracticeStore.subscribe((state, prev) => {
      if (state.speed === prev.speed) return;
      audioRef.current.scheduler?.setSpeed(state.speed);
    });
    return unsub;
  }, []);

  // ─── Phase 6: Practice Engine lifecycle (extracted to hook) ──
  const { handleNoteRendererReady, noteRendererRef } = usePracticeLifecycle(
    song,
    audioRef,
  );
  // ─── End Phase 6 ─────────────────────────────────────

  // ─── Phase 6.5: Startup wiring — showFallingNoteLabels ─
  // Sync the falling note label setting to NoteRenderer whenever it changes.
  const showFallingNoteLabels = useSettingsStore(
    (s) => s.showFallingNoteLabels,
  );
  const showNoteLabels = useSettingsStore((s) => s.showNoteLabels);
  const compactKeyLabels = useSettingsStore((s) => s.compactKeyLabels);
  useEffect(() => {
    if (noteRendererRef.current) {
      noteRendererRef.current.showNoteLabels = showFallingNoteLabels;
      noteRendererRef.current.keySig = song?.keySignatures?.[0]?.key ?? 0;
    }
  }, [showFallingNoteLabels, noteRendererRef, song]);
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
      try {
        const result = await window.api.loadMidiPath(filePath);
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
          if (dragErrorTimerRef.current) clearTimeout(dragErrorTimerRef.current);
          dragErrorTimerRef.current = setTimeout(() => setDragError(null), 3000);
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

  const handleExitPlayback = useCallback(() => {
    useSongStore.getState().clearSong();
    usePlaybackStore.getState().reset();
    applyRoute("menu");
  }, [applyRoute]);

  const isSplitMode = displayMode === "split";
  const splitFocus = isSplitMode ? splitFocusPanel : "sheet";
  const keyboardHeightMap = { normal: 100, large: 130, xlarge: 160 } as const;
  const splitKeyboardHeightMap = {
    normal: 84,
    large: 110,
    xlarge: 140,
  } as const;
  const keyboardHeight = isSplitMode
    ? splitKeyboardHeightMap[uiScale]
    : keyboardHeightMap[uiScale];
  const reservedChromeHeight =
    HEADER_ESTIMATED_HEIGHT +
    TRANSPORT_ESTIMATED_HEIGHT +
    TOOLBAR_ESTIMATED_HEIGHT +
    keyboardHeight +
    CHROME_VERTICAL_PADDING;
  const estimatedWorkspaceHeight = Math.max(
    260,
    viewportHeight - reservedChromeHeight,
  );
  const splitSheetHeight = isSplitMode
    ? Math.round(
        clampNumber(
          estimatedWorkspaceHeight * SPLIT_SHEET_RATIO,
          SPLIT_SHEET_MIN,
          SPLIT_SHEET_MAX,
        ),
      )
    : undefined;
  const splitFallingAvailableHeight =
    isSplitMode && splitSheetHeight !== undefined
      ? Math.max(0, estimatedWorkspaceHeight - splitSheetHeight)
      : 0;
  const splitFallingMinHeight = isSplitMode
    ? Math.max(
        SPLIT_FALLING_MIN,
        Math.min(
          Math.max(
            SPLIT_FALLING_MIN,
            Math.round(estimatedWorkspaceHeight * 0.42),
          ),
          splitFallingAvailableHeight,
        ),
      )
    : null;
  const fallingCanvasMinHeight = isSplitMode
    ? (splitFallingMinHeight ?? 0)
    : 200;
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
      <OnboardingGuide />
      <KeyboardShortcutsHelp />

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
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

      {/* Drag error toast */}
      {dragError && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-body subtle-shadow"
          style={{
            background:
              "color-mix(in srgb, #dc2626 55%, var(--color-surface))",
            color: "var(--color-text)",
            border: "1px solid color-mix(in srgb, #dc2626 30%, var(--color-border))",
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
          className="flex-1 min-h-0 flex flex-col animate-page-enter px-3 pb-3 pt-3"
          data-testid="playback-view"
        >
          <div
            className={`surface-panel subtle-shadow ${
              isSplitMode ? "px-2 py-1.5 mb-1.5" : "px-2.5 py-2 mb-2"
            }`}
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
                  <span className="hidden sm:inline">{t("settings.title")}</span>
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
                  <section className="app-side-section">
                    <DeviceSelector />
                  </section>
                  <section className="app-side-section flex items-center gap-2">
                    <button
                      onClick={() => {
                        setShowPlaybackDrawer(false);
                        setShowInsights(true);
                      }}
                      className="btn-surface-themed w-8 h-8 flex items-center justify-center rounded-full cursor-pointer"
                      title={t("app.insightsTitle")}
                      aria-label={t("app.insightsTitle")}
                      data-testid="insights-trigger"
                    >
                      <BarChart3
                        size={16}
                        style={{ color: "var(--color-text)" }}
                      />
                    </button>
                    <SettingsPanel />
                  </section>
                </div>
              </aside>
            </div>
          )}

          {/* Main display area: sheet music / falling notes / both */}
          <div
            className={`workspace-frame ${isPlaying ? "workspace-frame-live" : ""} flex-1 relative flex flex-col min-h-0 surface-panel overflow-hidden`}
          >
            {/* Sheet music panel (shown in split & sheet modes) */}
            <div
              className="relative"
              style={
                isSplitMode
                  ? {
                      filter:
                        splitFocus === "sheet"
                          ? "saturate(1.03) brightness(1.015)"
                          : "saturate(0.9) brightness(0.965)",
                      transition: "filter 160ms ease",
                    }
                  : undefined
              }
              onMouseEnter={() => isSplitMode && setSplitFocusPanel("sheet")}
              data-testid="split-sheet-region"
            >
              <SheetMusicPanel
                notationData={notationData}
                mode={displayMode}
                height={splitSheetHeight}
              />
            </div>

            {/* Falling notes canvas — always mounted so PixiJS ticker keeps
                running (WaitMode relies on it). Hidden via CSS in sheet mode. */}
            <div
              data-testid="falling-notes-panel"
              className="flex-1 min-h-0 relative flex flex-col"
              style={{
                display: displayMode === "sheet" ? "none" : "flex",
                filter:
                  isSplitMode && splitFocus === "sheet"
                    ? "saturate(0.9) brightness(0.965)"
                    : undefined,
                transition: isSplitMode ? "filter 160ms ease" : undefined,
              }}
              onMouseEnter={() => isSplitMode && setSplitFocusPanel("falling")}
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

          {/* Insights modal */}
          {showInsights && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop-cinematic"
              onClick={() => setShowInsights(false)}
              data-testid="insights-modal-backdrop"
            >
              <div
                className="w-[92vw] max-w-[460px] max-h-[85vh] overflow-y-auto modal-card-cinematic subtle-shadow-md"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={t("app.insightsTitle")}
                data-testid="insights-modal"
              >
                <InsightsPanel
                  insight={insight}
                  onClose={() => setShowInsights(false)}
                />
              </div>
            </div>
          )}

          {/* Transport bar */}
          <TransportBar compact={isSplitMode} />

          {/* Practice toolbar */}
          <PracticeToolbar compact={isSplitMode} />

          {/* Piano keyboard */}
          <PianoKeyboard
            activeNotes={activeNotes}
            midiActiveNotes={midiActiveNotes}
            height={keyboardHeight}
            showLabels={showNoteLabels}
            compactLabels={compactKeyLabels}
          />

          {/* Count-in overlay (shown before playback starts) */}
          <CountInOverlay
            visible={countInActive}
            bpm={rawEffectiveBpm ?? 120}
            countInBeats={countInBeats}
            onComplete={handleCountInComplete}
          />

          {/* Mode selection modal (shown when a song first loads) */}
          {showModeModal && (
            <ModeSelectionModal
              onSelect={handleModeSelect}
              onClose={() => setShowModeModal(false)}
            />
          )}

          {/* Celebration overlay (shown when song ends).
              "Pick Song" leads to StatisticsPage instead of directly back. */}
          {showCelebration && (
            <CelebrationOverlay
              score={score}
              visible={showCelebration}
              onPracticeAgain={handlePracticeAgain}
              onChooseSong={() => {
                setShowCelebration(false);
                setShowStats(true);
              }}
              onDismiss={() => {
                setShowCelebration(false);
                setShowStats(true);
              }}
              songId={songId}
              mode={mode}
            />
          )}

          {/* Statistics page (shown after celebration) */}
          {showStats && (
            <StatisticsPage
              score={score}
              songName={song?.fileName ?? ""}
              mode={mode}
              speed={speed}
              durationSeconds={Math.round(
                (Date.now() - sessionStartRef.current) / 1000,
              )}
              onPlayAgain={handlePracticeAgain}
              onChooseSong={handleChooseSong}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
