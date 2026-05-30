import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  PanelRightOpen,
  PencilRuler,
  X,
} from "lucide-react";
import { useSongStore } from "./stores/useSongStore";
import { useSongLibraryStore } from "./stores/useSongLibraryStore";
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
import { InsightsPanel } from "./features/insights/InsightsPanel";
import { WeakSpotAnalyzer } from "./features/insights/WeakSpotAnalyzer";
import { buildSessionSummariesForSong } from "./features/insights/sessionSummary";
import { useMidiDeviceStore } from "./stores/useMidiDeviceStore";
import { usePracticeLifecycle } from "./features/practice/usePracticeLifecycle";
import { PracticeToolbar } from "./features/practice/PracticeToolbar";
import { ScoreOverlay } from "./features/practice/ScoreOverlay";
import { useDialogFocus } from "./hooks/useDialogFocus";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTranslation } from "./i18n/useTranslation";
import { SheetMusicPanel } from "./features/sheetMusic/SheetMusicPanel";
import { DisplayModeToggle } from "./features/sheetMusic/DisplayModeToggle";
import { convertToNotation } from "./features/sheetMusic/MidiToNotation";
import type { NotationData } from "./features/sheetMusic/types";
import {
  getSheetMusicVisualFixture,
  type SheetMusicVisualFixtureName,
} from "./features/sheetMusic/sheetMusicVisualFixtures";
import { resolveBuiltinNotationMetadata } from "./features/sheetMusic/builtinNotationMetadata";
import { usePracticeStore } from "./stores/usePracticeStore";
import { MainMenu } from "./features/mainMenu/MainMenu";
import { ModeSelectionModal } from "./features/practice/ModeSelectionModal";
import { CelebrationOverlay } from "./features/practice/CelebrationOverlay";
import { PianoRollEditor } from "./features/editor/PianoRollEditor";
import { selectNextPracticeAction } from "./features/practice/nextPracticeAction";
import { getFocusModeExitDecision } from "./features/practice/focusModeExitGuard";
import { usePostSessionFlow } from "./features/practice/usePostSessionFlow";
import {
  resolveSongPracticeSetupForSong,
  type TrackPracticePreferences,
} from "./features/practice/songPracticeSetup";
import { StatisticsPage } from "./features/statistics/StatisticsPage";
import type { PracticeMode, PracticeScore } from "@shared/types";
import {
  parseRouteHash,
  resolveRoute,
  routeToHash,
  type AppRoute,
} from "./features/routing/appRoute";
import { useMidiImportActions } from "./features/fileImport/useMidiImportActions";
import { buildMidiDiagnosticNotice } from "./features/midiDiagnostics/midiDiagnosticNotice";

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

function getMutedTrackIndices(
  preferences: Record<number, TrackPracticePreferences> | undefined,
): Set<number> {
  const mutedTracks = new Set<number>();
  for (const [trackIndex, preference] of Object.entries(preferences ?? {})) {
    const index = Number(trackIndex);
    if (Number.isInteger(index) && index >= 0 && preference.muted === true) {
      mutedTracks.add(index);
    }
  }
  return mutedTracks;
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
  const [showEditor, setShowEditor] = useState(false);
  const playbackDrawerRef = useRef<HTMLElement>(null);
  const playbackDrawerTriggerRef = useRef<HTMLButtonElement>(null);
  const playbackDrawerCloseRef = useRef<HTMLButtonElement>(null);
  const closePlaybackDrawer = useCallback(() => {
    setShowPlaybackDrawer(false);
  }, []);
  useDialogFocus({
    active: showPlaybackDrawer,
    containerRef: playbackDrawerRef,
    initialFocusRef: playbackDrawerCloseRef,
    returnFocusRef: playbackDrawerTriggerRef,
    onDismiss: closePlaybackDrawer,
  });

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

  useEffect(() => {
    return useSongStore.subscribe((state) => {
      if (!state.song) {
        setShowEditor(false);
      }
    });
  }, []);

  // ─── Mode selection + celebration + stats flow ────────
  const mode = usePracticeStore((s) => s.mode);
  const speed = usePracticeStore((s) => s.speed);
  const activeTracks = usePracticeStore((s) => s.activeTracks);
  const score = usePracticeStore((s) => s.score);
  const {
    showModeModal,
    showCelebration,
    showStats,
    displayScore,
    handleModeSelect,
    handlePracticeAgain,
    handleChooseSong,
    handleViewStats,
    hidePostSessionFlow,
    showCelebrationForScore,
  } = usePostSessionFlow({
    song,
    activeTracks,
    speed,
    score,
    onChooseSongRoute: () => applyRoute("menu"),
  });
  // ─── End mode/celebration/stats flow ──────────────────

  // ─── Phase 6.5 Sprint 5: Insights Panel ──────────────
  const [showInsights, setShowInsights] = useState(false);
  const sessions = useProgressStore((s) => s.sessions);
  const songId = song?.fileName ?? "";

  const insight = useMemo(() => {
    if (!songId || sessions.length === 0) return null;
    const summaries = buildSessionSummariesForSong(songId, sessions, song);
    return analyzer.analyze(songId, summaries);
  }, [song, songId, sessions]);

  const nextPracticeAction = useMemo(
    () =>
      selectNextPracticeAction({
        score: displayScore,
        mode,
        speed,
        tracksPlayed: Array.from(activeTracks),
        weakSpots: insight?.weakSpots,
        weakSections: insight?.weakSections,
      }),
    [
      activeTracks,
      displayScore,
      insight?.weakSections,
      insight?.weakSpots,
      mode,
      speed,
    ],
  );

  // ─── Phase 7: Sheet Music ──────────────────────────────
  const displayMode = usePracticeStore((s) => s.displayMode);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const builtinSongs = useSongLibraryStore((s) => s.songs);
  const [sheetFixtureNotationData, setSheetFixtureNotationData] =
    useState<NotationData | null>(null);
  const builtinNotationMetadata = useMemo(() => {
    if (!song) return null;
    return resolveBuiltinNotationMetadata(song.fileName, builtinSongs);
  }, [builtinSongs, song]);

  const notationData = useMemo(() => {
    if (sheetFixtureNotationData) return sheetFixtureNotationData;
    if (!song) return null;
    const allNotes = song.tracks.flatMap((tr) => tr.notes);
    const bpm = song.tempos.length > 0 ? song.tempos[0].bpm : 120;
    const midiTimeSignature = song.timeSignatures[0];
    const timeSignatureTop =
      builtinNotationMetadata?.timeSignatureTop ??
      midiTimeSignature?.numerator ??
      4;
    const timeSignatureBottom =
      builtinNotationMetadata?.timeSignatureBottom ??
      midiTimeSignature?.denominator ??
      4;
    const keySignature = builtinNotationMetadata?.keySignature ?? 0;

    return convertToNotation(
      allNotes,
      bpm,
      480,
      timeSignatureTop,
      timeSignatureBottom,
      keySignature,
    );
  }, [builtinNotationMetadata, sheetFixtureNotationData, song]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fixtureAccessEnabled =
      navigator.webdriver ||
      window.localStorage.getItem("rexiano-e2e-fixtures") === "1";
    if (!fixtureAccessEnabled) return;

    const e2eWindow = window as typeof window & {
      __rexianoLoadSheetMusicFixture?: (
        fixtureName: SheetMusicVisualFixtureName,
      ) => void;
      __rexianoShowCelebrationFixture?: (fixture: {
        score: PracticeScore;
        mode?: PracticeMode;
        speed?: number;
      }) => void;
      __rexianoForcePlaybackState?: (state: { isPlaying?: boolean }) => void;
    };

    e2eWindow.__rexianoLoadSheetMusicFixture = (fixtureName) => {
      const fixture = getSheetMusicVisualFixture(fixtureName);
      reset();
      usePracticeStore.getState().setDisplayMode("sheet");
      usePracticeStore.getState().setMode("watch");
      setSheetFixtureNotationData(fixture.notationData);
      loadSong(fixture.song);
      hidePostSessionFlow();
      setShowInsights(false);
      applyRoute("playback");
    };

    e2eWindow.__rexianoShowCelebrationFixture = (celebrationFixture) => {
      const fixture = getSheetMusicVisualFixture("dense-sparse");
      reset();
      setSheetFixtureNotationData(fixture.notationData);
      loadSong(fixture.song);
      usePracticeStore.getState().setMode(celebrationFixture.mode ?? "wait");
      usePracticeStore.getState().setSpeed(celebrationFixture.speed ?? 1);
      usePracticeStore.setState({
        score: celebrationFixture.score,
        activeTracks: new Set([0]),
        noteResults: new Map(),
      });
      showCelebrationForScore(celebrationFixture.score);
      setShowInsights(false);
      applyRoute("playback");
    };
    e2eWindow.__rexianoForcePlaybackState = (state) => {
      // Intentionally bypass subscriptions so E2E can exercise focus-mode exit
      // wiring without depending on platform audio startup behavior.
      const playback = usePlaybackStore.getState();
      if (typeof state.isPlaying === "boolean") {
        playback.isPlaying = state.isPlaying;
      }
    };

    return () => {
      delete e2eWindow.__rexianoLoadSheetMusicFixture;
      delete e2eWindow.__rexianoShowCelebrationFixture;
      delete e2eWindow.__rexianoForcePlaybackState;
    };
  }, [
    applyRoute,
    hidePostSessionFlow,
    loadSong,
    reset,
    showCelebrationForScore,
  ]);

  // ─── End Phase 7 ──────────────────────────────────────

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const midiActiveNotes = useMidiDeviceStore((s) => s.activeNotes);
  const [viewportSize, setViewportSize] = useState(() =>
    typeof window !== "undefined"
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1440, height: 900 },
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
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
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

      const { muted } = useSettingsStore.getState();
      engine.setVolume(muted ? 0 : usePlaybackStore.getState().volume);

      // Rebind metronome to the latest live AudioContext after recovery/rebuild.
      disposeMetronome();
      if (engine.audioContext) {
        initMetronome(engine.audioContext);
      }

      scheduler.setSong(targetSong);
      scheduler.setSpeed(usePracticeStore.getState().speed);
      scheduler.setMutedTracks(
        getMutedTrackIndices(usePracticeStore.getState().trackPreferences),
      );
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
        scheduler.setMutedTracks(
          getMutedTrackIndices(usePracticeStore.getState().trackPreferences),
        );
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

    // Apply saved per-song setup, falling back to app defaults when none exists.
    const { defaultMode, defaultSpeed } = useSettingsStore.getState();
    const setup = resolveSongPracticeSetupForSong(song, {
      defaultMode,
      defaultSpeed,
    });
    usePracticeStore.getState().setMode(setup.defaultMode);
    usePracticeStore.getState().setSpeed(setup.defaultSpeed);
    usePracticeStore.getState().setActiveTracks(new Set(setup.activeTracks));
    usePracticeStore.getState().setSongPracticeSetup({
      handAssignments: setup.handAssignments,
      trackPreferences: setup.trackPreferences,
    });

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

  const handleFallingNoteRendererReady = useCallback(
    (renderer: Parameters<typeof handleNoteRendererReady>[0]) => {
      handleNoteRendererReady(renderer);
      const { handAssignments, trackPreferences } = usePracticeStore.getState();
      renderer.setTrackDisplayPreferences({
        handAssignments,
        trackPreferences,
      });
    },
    [handleNoteRendererReady],
  );

  // ─── Phase 7.5: per-song track setup runtime sync ─────
  useEffect(() => {
    const unsub = usePracticeStore.subscribe((state, prev) => {
      if (state.trackPreferences !== prev.trackPreferences) {
        audioRef.current.scheduler?.setMutedTracks(
          getMutedTrackIndices(state.trackPreferences),
        );
      }
      if (
        state.handAssignments !== prev.handAssignments ||
        state.trackPreferences !== prev.trackPreferences
      ) {
        noteRendererRef.current?.setTrackDisplayPreferences({
          handAssignments: state.handAssignments,
          trackPreferences: state.trackPreferences,
        });
      }
    });
    return unsub;
  }, [noteRendererRef]);
  // ─── End Phase 6 ─────────────────────────────────────

  // ─── Phase 6.5: Startup wiring — showFallingNoteLabels ─
  // Sync the falling note label setting to NoteRenderer whenever it changes.
  const showFallingNoteLabels = useSettingsStore(
    (s) => s.showFallingNoteLabels,
  );
  const compactKeyLabels = useSettingsStore((s) => s.compactKeyLabels);
  useEffect(() => {
    if (noteRendererRef.current) {
      noteRendererRef.current.showNoteLabels = showFallingNoteLabels;
    }
  }, [showFallingNoteLabels, noteRendererRef]);
  // ─── End Phase 6.5 ───────────────────────────────────

  const {
    importError,
    isDragging,
    handleOpenFile,
    handleLoadMidiPath,
    handleImportRecoveryAction,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useMidiImportActions({
    t,
    loadSong,
    resetPlayback: reset,
  });

  // ─── Phase 6.5: Mute toggle ────────────────────────────
  const muteRef = useRef({ prevVolume: 0.8 });
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

  const handleExitPlayback = useCallback(() => {
    const decision = getFocusModeExitDecision({
      childFocusMode: useSettingsStore.getState().childFocusMode,
      isPlaying: usePlaybackStore.getState().isPlaying,
      hasSong: useSongStore.getState().song !== null,
    });

    if (decision.pauseBeforeConfirm) {
      usePlaybackStore.getState().setPlaying(false);
    }
    if (
      decision.confirmBeforeExit &&
      !window.confirm(t("practice.confirmExitPlaying"))
    ) {
      return;
    }

    useSongStore.getState().clearSong();
    usePlaybackStore.getState().reset();
    applyRoute("menu");
  }, [applyRoute, t]);

  const isSplitMode = displayMode === "split";
  const viewportHeight = viewportSize.height;
  const isNarrowViewport = viewportSize.width < 640;
  const compactPlaybackChrome = isSplitMode || isNarrowViewport;
  const splitFocus = isSplitMode ? splitFocusPanel : "sheet";
  const keyboardHeight = isSplitMode ? 84 : isNarrowViewport ? 72 : 100;
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
    ? Math.min(
        Math.max(
          SPLIT_FALLING_MIN,
          Math.round(estimatedWorkspaceHeight * 0.42),
        ),
        splitFallingAvailableHeight,
      )
    : null;
  const fallingCanvasMinHeight = isSplitMode
    ? (splitFallingMinHeight ?? 0)
    : 200;
  const speedPercent = Math.round(speed * 100);
  const baseBpm =
    song?.tempos && song.tempos.length > 0
      ? Math.round(song.tempos[0].bpm)
      : null;
  const effectiveBpm =
    baseBpm !== null ? Math.max(1, Math.round(baseBpm * speed)) : null;
  const midiDiagnosticNotice = useMemo(
    () =>
      song
        ? buildMidiDiagnosticNotice(song, {
            hasTimeSignatureMetadata:
              builtinNotationMetadata?.timeSignatureTop !== undefined &&
              builtinNotationMetadata?.timeSignatureBottom !== undefined,
            notationData,
          })
        : null,
    [builtinNotationMetadata, notationData, song],
  );

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
          style={{
            background: "rgba(6, 10, 12, 0.55)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="rounded-3xl px-10 py-8 text-center subtle-shadow-md"
            style={{
              background:
                "color-mix(in srgb, var(--color-surface) 90%, transparent)",
              border: "3px dashed var(--color-accent)",
            }}
          >
            <p
              className="text-lg font-semibold font-body"
              style={{ color: "var(--color-text)" }}
            >
              {t("app.dropMidi")}
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("app.supportedFormats")}
            </p>
          </div>
        </div>
      )}

      {/* Drag error toast */}
      {importError && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-[420px] rounded-lg px-4 py-3 text-sm font-body subtle-shadow"
          style={{
            background: "#dc2626",
            color: "#ffffff",
          }}
          title={importError.guidance.diagnostic || undefined}
          data-testid="file-import-error-toast"
        >
          <div className="font-semibold">{importError.guidance.title}</div>
          <div className="mt-0.5 text-xs leading-snug">
            {importError.guidance.guidance}
          </div>
          {importError.guidance.actions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {importError.guidance.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() =>
                    handleImportRecoveryAction(action.id, importError.input)
                  }
                  className="rounded px-2 py-1 text-[11px] font-body font-semibold cursor-pointer"
                  style={{
                    color:
                      action.emphasis === "primary" ? "#991b1b" : "#ffffff",
                    background:
                      action.emphasis === "primary"
                        ? "#ffffff"
                        : "rgba(255, 255, 255, 0.14)",
                    border: "1px solid rgba(255, 255, 255, 0.45)",
                  }}
                  data-import-recovery-action={action.id}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
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
            <div className="flex items-center gap-1.5 justify-between min-w-0">
              <div
                className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden"
                data-testid="playback-title-meta-row"
              >
                <span className="kicker-label shrink-0 text-[11px]">
                  {t("app.subtitle")}
                </span>
                <h2
                  className="font-semibold font-body truncate text-[1.02rem] leading-tight max-w-[min(40vw,420px)]"
                  data-testid="playback-song-title"
                >
                  {song.fileName}
                </h2>

                <div
                  className="flex items-center gap-1 min-w-0 overflow-hidden"
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
                className="flex items-center gap-1 shrink-0"
                data-testid="playback-header-actions"
              >
                <button
                  ref={playbackDrawerTriggerRef}
                  onClick={() => setShowPlaybackDrawer(true)}
                  className="btn-surface-themed flex min-h-9 items-center gap-1 rounded-lg font-body cursor-pointer px-2 py-[3px] text-[10px]"
                  data-testid="playback-drawer-trigger"
                >
                  <PanelRightOpen size={13} />
                  {t("settings.title")}
                </button>
                <button
                  onClick={handleExitPlayback}
                  className="btn-surface-themed flex min-h-9 items-center gap-1 rounded-lg font-body cursor-pointer px-2 py-[3px] text-[10px]"
                >
                  <ArrowLeft size={13} />
                  {t("song.backToLibrary")}
                </button>
              </div>
            </div>
            {midiDiagnosticNotice && (
              <div
                className="mt-1.5 flex items-start gap-1.5 rounded-lg px-2 py-1 text-[11px] leading-snug"
                style={{
                  color:
                    midiDiagnosticNotice.kind === "error"
                      ? "#991b1b"
                      : "var(--color-text)",
                  background:
                    midiDiagnosticNotice.kind === "error"
                      ? "color-mix(in srgb, #fee2e2 82%, var(--color-surface))"
                      : "color-mix(in srgb, var(--color-streak-gold) 18%, var(--color-surface))",
                  border:
                    midiDiagnosticNotice.kind === "error"
                      ? "1px solid color-mix(in srgb, #dc2626 35%, transparent)"
                      : "1px solid color-mix(in srgb, var(--color-streak-gold) 40%, transparent)",
                }}
                title={midiDiagnosticNotice.diagnosticTitle}
                data-testid="midi-diagnostic-notice"
              >
                <AlertTriangle size={13} className="mt-[1px] shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold">
                    {midiDiagnosticNotice.title}
                  </span>
                  <span className="ml-1">{midiDiagnosticNotice.summary}</span>
                  {midiDiagnosticNotice.details.length > 0 && (
                    <span className="ml-1 text-[10px] opacity-80">
                      {midiDiagnosticNotice.details[0]}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {showPlaybackDrawer && (
            <div className="app-overlay-backdrop" onClick={closePlaybackDrawer}>
              <aside
                ref={playbackDrawerRef}
                className="app-side-drawer"
                role="dialog"
                aria-modal="true"
                aria-label={t("settings.title")}
                tabIndex={-1}
                data-testid="playback-settings-drawer"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="app-side-drawer-header">
                  <span className="kicker-label">{t("settings.title")}</span>
                  <button
                    ref={playbackDrawerCloseRef}
                    onClick={closePlaybackDrawer}
                    className="btn-surface-themed w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
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
                        setShowEditor(true);
                      }}
                      className="btn-surface-themed w-9 h-9 flex items-center justify-center rounded-full cursor-pointer"
                      title="Piano roll editor"
                      aria-label="Piano roll editor"
                      data-testid="open-editor"
                    >
                      <PencilRuler
                        size={16}
                        style={{ color: "var(--color-text)" }}
                      />
                    </button>
                    <button
                      onClick={() => {
                        setShowPlaybackDrawer(false);
                        setShowInsights(true);
                      }}
                      className="btn-surface-themed w-9 h-9 flex items-center justify-center rounded-full cursor-pointer"
                      title={t("app.insightsTitle")}
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

          {/* Main display area: editor / sheet music / falling notes / both */}
          <div
            className={`workspace-frame ${isPlaying ? "workspace-frame-live" : ""} flex-1 relative flex flex-col min-h-0 surface-panel overflow-hidden`}
          >
            {showEditor && song ? (
              <PianoRollEditor
                key={song.fileName}
                parsedSong={song}
                onClose={() => setShowEditor(false)}
              />
            ) : (
              <>
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
                  onMouseEnter={() =>
                    isSplitMode && setSplitFocusPanel("sheet")
                  }
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
                  onMouseEnter={() =>
                    isSplitMode && setSplitFocusPanel("falling")
                  }
                >
                  <FallingNotesCanvas
                    onActiveNotesChange={handleActiveNotesChange}
                    getAudioCurrentTime={getAudioCurrentTime}
                    onNoteRendererReady={handleFallingNoteRendererReady}
                    minHeight={fallingCanvasMinHeight}
                  />
                </div>
                <ScoreOverlay />
              </>
            )}
          </div>

          {/* Insights modal */}
          {showInsights && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop-cinematic"
              onClick={() => setShowInsights(false)}
            >
              <div
                className="w-[92vw] max-w-[460px] max-h-[85vh] overflow-y-auto modal-card-cinematic subtle-shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <InsightsPanel
                  insight={insight}
                  onClose={() => setShowInsights(false)}
                />
              </div>
            </div>
          )}

          {/* Transport bar */}
          <TransportBar compact={compactPlaybackChrome} />

          {/* Practice toolbar */}
          <PracticeToolbar compact={compactPlaybackChrome} />

          {/* Piano keyboard */}
          <PianoKeyboard
            activeNotes={activeNotes}
            midiActiveNotes={midiActiveNotes}
            height={keyboardHeight}
            compactLabels={compactKeyLabels}
          />

          {/* Mode selection modal (shown when a song first loads) */}
          {showModeModal && <ModeSelectionModal onSelect={handleModeSelect} />}

          {/* Celebration overlay (shown when song ends).
              "Pick Song" leads to StatisticsPage instead of directly back. */}
          {showCelebration && (
            <CelebrationOverlay
              score={displayScore}
              visible={showCelebration}
              onPracticeAgain={handlePracticeAgain}
              onChooseSong={handleViewStats}
              songId={songId}
              nextAction={nextPracticeAction}
            />
          )}

          {/* Statistics page (shown after celebration) */}
          {showStats && (
            <StatisticsPage
              score={displayScore}
              songName={song?.fileName ?? ""}
              mode={mode}
              speed={speed}
              durationSeconds={Math.round(currentTime)}
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
