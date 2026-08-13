import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
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
  getMetronome,
} from "./engines/metronome/metronomeManager";
import {
  beginMetronomePlayback,
  rebaseMetronomeDiscontinuity,
  syncMetronomeToPlayback,
} from "./engines/metronome/metronomeRuntime";
import { resolveMetronomeSegmentKey } from "./engines/metronome/metronomeTiming";
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
import { recoverLatestPlaybackIntent } from "./engines/audio/audioRecoveryIntent";
import {
  AudioInitializationOwner,
  runOwnedAudioInitialization,
  type AudioInitializationOutcome,
} from "./engines/audio/audioInitializationOwnership";
import { FallingNotesCanvas } from "./features/fallingNotes/FallingNotesCanvas";
import { PianoKeyboard } from "./features/fallingNotes/PianoKeyboard";
import { TransportBar } from "./features/fallingNotes/TransportBar";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { SongLibrary } from "./features/songLibrary/SongLibrary";
import { DeviceSelector } from "./features/midiDevice/DeviceSelector";
import { BluetoothDeviceSelectionDialog } from "./features/midiDevice/BluetoothDeviceSelectionDialog";
import { InsightsPanel } from "./features/insights/InsightsPanel";
import { WeakSpotAnalyzer } from "./features/insights/WeakSpotAnalyzer";
import { buildSessionSummariesForSong } from "./features/insights/sessionSummary";
import {
  getMidiPlaybackOutputSender,
  useMidiDeviceStore,
} from "./stores/useMidiDeviceStore";
import {
  resetPracticeSession,
  shouldStartPracticeScheduler,
  usePracticeLifecycle,
} from "./features/practice/usePracticeLifecycle";
import { PracticeToolbar } from "./features/practice/PracticeToolbar";
import { ScoreOverlay } from "./features/practice/ScoreOverlay";
import { useDialogFocus } from "./hooks/useDialogFocus";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTranslation } from "./i18n/useTranslation";
import { SheetMusicPanel } from "./features/sheetMusic/SheetMusicPanel";
import { DisplayModeToggle } from "./features/sheetMusic/DisplayModeToggle";
import { convertSongToNotation } from "./features/sheetMusic/MidiToNotation";
import { TempoMap } from "./engines/midi/TempoMap";
import { TransportClock } from "./engines/transport/TransportClock";
import {
  registerPlaybackDiscontinuityHandler,
  seekPlayback,
} from "./engines/transport/playbackDiscontinuity";
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
import {
  canStartRequestedPlayback,
  usePostSessionFlow,
} from "./features/practice/usePostSessionFlow";
import { getPracticeEngines } from "./engines/practice/practiceManager";
import {
  mapSessionIntentToMode,
  type PracticeSessionIntent,
} from "./features/practice/sessionIntent";
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
import { FileImportErrorAlert } from "./features/fileImport/FileImportErrorAlert";
import { buildMidiDiagnosticNotice } from "./features/midiDiagnostics/midiDiagnosticNotice";
import { OnboardingGuide } from "./features/onboarding/OnboardingGuide";
import { shouldExposeE2eFixtures } from "./e2eFixtureAccess";
import { useRecentFiles } from "./hooks/useRecentFiles";

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
  const {
    recentFiles,
    refresh: refreshRecentFiles,
    remove: removeRecentFile,
  } = useRecentFiles();
  const [routeIntent, setRouteIntent] = useState<AppRoute>(() => {
    if (typeof window === "undefined") return "menu";
    return parseRouteHash(window.location.hash);
  });
  const [showMenuSettings, setShowMenuSettings] = useState(false);
  const [sessionIntent, setSessionIntentState] =
    useState<PracticeSessionIntent>("practice");
  const sessionIntentRef = useRef<PracticeSessionIntent>("practice");
  const setSessionIntent = useCallback((intent: PracticeSessionIntent) => {
    sessionIntentRef.current = intent;
    setSessionIntentState(intent);
  }, []);

  // Routing rule source of truth:
  // - Has song => playback
  // - No song + playback route => menu
  const view: AppRoute = resolveRoute(routeIntent, !!song);
  const [showPlaybackDrawer, setShowPlaybackDrawer] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const appShellRef = useRef<HTMLDivElement>(null);
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
        getMetronome()?.stop();
        usePlaybackStore.getState().setCountInActive(false);
      }
    });
  }, []);

  // ─── Mode selection + celebration + stats flow ────────
  const mode = usePracticeStore((s) => s.mode);
  const speed = usePracticeStore((s) => s.speed);
  const activeTracks = usePracticeStore((s) => s.activeTracks);
  const score = usePracticeStore((s) => s.score);
  const pendingPlaybackStartSongRef = useRef<NonNullable<typeof song> | null>(
    null,
  );
  const audioReadySongRef = useRef<NonNullable<typeof song> | null>(null);
  const audioInitializationOwnerRef = useRef<AudioInitializationOwner | null>(
    null,
  );
  if (!audioInitializationOwnerRef.current) {
    audioInitializationOwnerRef.current = new AudioInitializationOwner();
  }
  const attemptPendingPlaybackStart = useCallback((): boolean => {
    const requestedSong = pendingPlaybackStartSongRef.current;
    if (
      !canStartRequestedPlayback({
        requestedSong,
        currentSong: useSongStore.getState().song,
        readySong: audioReadySongRef.current,
        audioStatus: usePlaybackStore.getState().audioStatus,
      })
    ) {
      return false;
    }

    pendingPlaybackStartSongRef.current = null;
    usePlaybackStore.getState().setPlaying(true);
    return true;
  }, []);
  const requestPlaybackStart = useCallback(
    (requestedSong: NonNullable<typeof song>): void => {
      pendingPlaybackStartSongRef.current = requestedSong;
      attemptPendingPlaybackStart();
    },
    [attemptPendingPlaybackStart],
  );
  const cancelPendingPlaybackStart = useCallback((): void => {
    pendingPlaybackStartSongRef.current = null;
    audioReadySongRef.current = null;
    audioInitializationOwnerRef.current?.invalidate();
  }, []);
  const getCurrentSessionIntent = useCallback(
    () => sessionIntentRef.current,
    [],
  );
  const handleChooseSongRoute = useCallback(() => {
    setSessionIntent("practice");
    applyRoute("library");
  }, [applyRoute, setSessionIntent]);
  const {
    showModeModal,
    showCelebration,
    showStats,
    displayScore,
    handleModeSelect,
    handleModeDismiss,
    handlePracticeAgain,
    handleChooseSong,
    handleViewStats,
    hidePostSessionFlow,
    showCelebrationForScore,
  } = usePostSessionFlow({
    song,
    sessionIntent,
    getSessionIntent: getCurrentSessionIntent,
    activeTracks,
    speed,
    score,
    onChooseSongRoute: handleChooseSongRoute,
    onRequestPlaybackStart: requestPlaybackStart,
    onCancelPendingPlaybackStart: cancelPendingPlaybackStart,
  });

  useEffect(() => {
    return useSongStore.subscribe((state, previousState) => {
      if (state.song !== previousState.song) {
        cancelPendingPlaybackStart();
      }
    });
  }, [cancelPendingPlaybackStart]);

  const modeSelectionDefault = useMemo((): PracticeMode => {
    if (!song) return mode;
    const { defaultMode, defaultSpeed } = useSettingsStore.getState();
    return mapSessionIntentToMode(
      sessionIntent,
      resolveSongPracticeSetupForSong(song, {
        defaultMode,
        defaultSpeed,
      }).defaultMode,
    );
  }, [mode, sessionIntent, song]);
  // ─── End mode/celebration/stats flow ──────────────────

  const resetAppViewportScroll = useCallback((): void => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    appShellRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.scrollingElement?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (view !== "playback" || !song || showModeModal) return;
    resetAppViewportScroll();
    const frameId = window.requestAnimationFrame(resetAppViewportScroll);
    const timerId = window.setTimeout(resetAppViewportScroll, 180);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
    };
  }, [resetAppViewportScroll, showModeModal, song, view]);

  // ─── Phase 6.5 Sprint 5: Insights Panel ──────────────
  const [showInsights, setShowInsights] = useState(false);
  const insightsDialogRef = useRef<HTMLDivElement>(null);
  const insightsCloseButtonRef = useRef<HTMLButtonElement>(null);
  const insightsTriggerRef = useRef<HTMLButtonElement>(null);
  const closeInsights = useCallback(() => setShowInsights(false), []);
  useDialogFocus({
    active: showInsights,
    containerRef: insightsDialogRef,
    initialFocusRef: insightsCloseButtonRef,
    returnFocusRef: insightsTriggerRef,
    onDismiss: closeInsights,
  });
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

    // Curated metadata may pin a meter for a built-in song; otherwise the
    // song's own time signature events drive the barlines, including changes.
    return convertSongToNotation(song, {
      keySignature: builtinNotationMetadata?.keySignature ?? 0,
      timeSignatureTop: builtinNotationMetadata?.timeSignatureTop,
      timeSignatureBottom: builtinNotationMetadata?.timeSignatureBottom,
    });
  }, [builtinNotationMetadata, sheetFixtureNotationData, song]);

  // Cursor placement needs exact seconds → ticks, which only the tempo map can
  // give once a song changes tempo. Fixture notation is synthetic and carries
  // no matching song, so it keeps the constant-BPM reading.
  const notationTempoMap = useMemo(() => {
    if (sheetFixtureNotationData || !song) return null;
    return TempoMap.fromSong(song);
  }, [sheetFixtureNotationData, song]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const fixtureAccessEnabled = shouldExposeE2eFixtures({
      isE2eTestMode: window.api.isE2eTestMode,
    });
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
      __rexianoPrimePracticeSessionFixture?: () => boolean;
      __rexianoPrepareWaitTargetFixture?: () => Promise<number[] | null>;
      __rexianoSendMidiNoteFixture?: (midi: number) => void;
      __rexianoSetPracticeLifecycleFixtureState?: (state: {
        isPlaying?: boolean;
        mode?: PracticeMode;
        activeTracks?: number[];
      }) => void;
      __rexianoGetPracticeSessionFixtureSnapshot?: () => {
        mode: PracticeMode;
        isPlaying: boolean;
        currentTime: number;
        waitState: string | null;
        waitResultCount: number;
        waitTargetCount: number;
        waitTargets: number[];
        engineScoreTotal: number;
        storeScoreTotal: number;
        storeResultCount: number;
      } | null;
      __rexianoGetMetronomeFixtureSnapshot?: () => {
        isPlaying: boolean;
        currentTime: number;
        countInActive: boolean;
        metronomeEnabled: boolean;
        isRunning: boolean;
        enabled: boolean;
        countInRemaining: number;
        scheduledClickCount: number;
      } | null;
    };

    e2eWindow.__rexianoLoadSheetMusicFixture = (fixtureName) => {
      const fixture = getSheetMusicVisualFixture(fixtureName);
      cancelPendingPlaybackStart();
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
      cancelPendingPlaybackStart();
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
    e2eWindow.__rexianoPrimePracticeSessionFixture = () => {
      const currentSong = useSongStore.getState().song;
      const { waitMode, scoreCalculator } = getPracticeEngines();
      const firstNote = currentSong?.tracks[0]?.notes[0];
      if (!currentSong || !waitMode || !scoreCalculator || !firstNote) {
        return false;
      }

      usePracticeStore.getState().setMode("wait");
      waitMode.reset();
      waitMode.start();
      waitMode.tick(currentSong.duration + 1);
      scoreCalculator.reset();
      scoreCalculator.noteHit(firstNote.midi, firstNote.time);
      usePracticeStore.getState().resetScore();
      usePracticeStore.getState().recordHit("__e2e_practice_fixture__");
      return true;
    };
    e2eWindow.__rexianoPrepareWaitTargetFixture = async () => {
      const currentSong = useSongStore.getState().song;
      const { waitMode, scoreCalculator } = getPracticeEngines();
      const firstNote = currentSong?.tracks[0]?.notes[0];
      if (!currentSong || !waitMode || !scoreCalculator || !firstNote) {
        return null;
      }

      usePlaybackStore.getState().setPlaying(false);
      usePracticeStore.getState().setMode("wait");
      usePracticeStore.getState().setActiveTracks(new Set([0]));
      resetPracticeSession({
        resetWaitMode: () => waitMode.reset(),
        resetScoreCalculator: () => scoreCalculator.reset(),
        resetPracticeScore: usePracticeStore.getState().resetScore,
      });
      seekPlayback(firstNote.time);
      usePlaybackStore.getState().setPlaying(true);
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      waitMode.start();
      waitMode.tick(firstNote.time);
      return [...waitMode.targetNotes];
    };
    e2eWindow.__rexianoSendMidiNoteFixture = (midi) => {
      useMidiDeviceStore.setState({ activeNotes: new Set([midi]) });
      useMidiDeviceStore.setState({ activeNotes: new Set() });
    };
    e2eWindow.__rexianoSetPracticeLifecycleFixtureState = (state) => {
      if (typeof state.isPlaying === "boolean") {
        usePlaybackStore.getState().setPlaying(state.isPlaying);
      }
      if (state.mode) {
        usePracticeStore.getState().setMode(state.mode);
      }
      if (state.activeTracks) {
        usePracticeStore
          .getState()
          .setActiveTracks(new Set(state.activeTracks));
      }
    };
    e2eWindow.__rexianoGetPracticeSessionFixtureSnapshot = () => {
      const { waitMode, scoreCalculator } = getPracticeEngines();
      if (!waitMode || !scoreCalculator) return null;
      const practice = usePracticeStore.getState();
      const playback = usePlaybackStore.getState();
      return {
        mode: practice.mode,
        isPlaying: playback.isPlaying,
        currentTime: playback.currentTime,
        waitState: waitMode.state,
        waitResultCount: waitMode.noteResults.size,
        waitTargetCount: waitMode.targetNotes.size,
        waitTargets: [...waitMode.targetNotes],
        engineScoreTotal: scoreCalculator.getScore().totalNotes,
        storeScoreTotal: practice.score.totalNotes,
        storeResultCount: practice.noteResults.size,
      };
    };
    e2eWindow.__rexianoGetMetronomeFixtureSnapshot = () => {
      const metronome = getMetronome();
      if (!metronome) return null;
      const playback = usePlaybackStore.getState();
      return {
        isPlaying: playback.isPlaying,
        currentTime: playback.currentTime,
        countInActive: playback.countInActive,
        metronomeEnabled: useSettingsStore.getState().metronomeEnabled,
        ...metronome.getRuntimeSnapshot(),
      };
    };

    return () => {
      delete e2eWindow.__rexianoLoadSheetMusicFixture;
      delete e2eWindow.__rexianoShowCelebrationFixture;
      delete e2eWindow.__rexianoForcePlaybackState;
      delete e2eWindow.__rexianoPrimePracticeSessionFixture;
      delete e2eWindow.__rexianoPrepareWaitTargetFixture;
      delete e2eWindow.__rexianoSendMidiNoteFixture;
      delete e2eWindow.__rexianoSetPracticeLifecycleFixtureState;
      delete e2eWindow.__rexianoGetPracticeSessionFixtureSnapshot;
      delete e2eWindow.__rexianoGetMetronomeFixtureSnapshot;
    };
  }, [
    applyRoute,
    cancelPendingPlaybackStart,
    hidePostSessionFlow,
    loadSong,
    reset,
    showCelebrationForScore,
  ]);

  // ─── End Phase 7 ──────────────────────────────────────

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const midiActiveNotes = useMidiDeviceStore((s) => s.activeNotes);
  const [wrongNotes, setWrongNotes] = useState<Set<number>>(new Set());
  const wrongNoteTimersRef = useRef(
    new Map<number, ReturnType<typeof setTimeout>>(),
  );
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

  const handleWrongPracticeInput = useCallback((midi: number): void => {
    const existingTimer = wrongNoteTimersRef.current.get(midi);
    if (existingTimer) clearTimeout(existingTimer);
    setWrongNotes((notes) => new Set(notes).add(midi));
    const timer = setTimeout(() => {
      setWrongNotes((notes) => {
        const next = new Set(notes);
        next.delete(midi);
        return next;
      });
      wrongNoteTimersRef.current.delete(midi);
    }, 420);
    wrongNoteTimersRef.current.set(midi, timer);
  }, []);

  useEffect(() => {
    return () => {
      for (const timer of wrongNoteTimersRef.current.values()) {
        clearTimeout(timer);
      }
      wrongNoteTimersRef.current.clear();
    };
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
  const metronomeSegmentRef = useRef<string | null>(null);
  const e2eAudioRecoveryDelayMsRef = useRef(0);
  const triggerRecoveryRef = useRef<(reason: string, error?: unknown) => void>(
    () => {},
  );

  const syncCurrentMetronome = useCallback((): void => {
    const engine = getMetronome();
    const liveSong = useSongStore.getState().song;
    const playback = usePlaybackStore.getState();
    if (playback.countInActive) return;
    if (!engine || !liveSong || !playback.isPlaying) {
      engine?.stop();
      metronomeSegmentRef.current = null;
      return;
    }

    syncMetronomeToPlayback({
      engine,
      song: liveSong,
      currentTime: playback.currentTime,
      speed: usePracticeStore.getState().speed,
      enabled: useSettingsStore.getState().metronomeEnabled,
    });
    metronomeSegmentRef.current = resolveMetronomeSegmentKey(
      liveSong,
      playback.currentTime,
      usePracticeStore.getState().speed,
    );
  }, []);

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
    async (
      targetSong: NonNullable<typeof song>,
    ): Promise<AudioInitializationOutcome> => {
      const { audioCompatibilityMode } = useSettingsStore.getState();
      const engine = new AudioEngine({
        latencyHint: audioCompatibilityMode ? "playback" : "interactive",
        onRuntimeError: (error) => {
          triggerRecoveryRef.current("runtime-device-failure", error);
        },
      });
      const scheduler = new AudioScheduler(engine);
      scheduler.setMidiOutput(getMidiPlaybackOutputSender());
      const stack = { engine, scheduler };
      const owner = audioInitializationOwnerRef.current;
      if (!owner) {
        throw new Error("Audio initialization owner is unavailable");
      }

      return runOwnedAudioInitialization(owner, {
        activate: () => {
          audioReadySongRef.current = null;
          audioRef.current.engine?.setRuntimeErrorHandler(null);
          audioRef.current.scheduler?.dispose();
          audioRef.current.engine?.dispose();
          audioRef.current = stack;
          usePlaybackStore.getState().setAudioStatus("loading");
        },
        initialize: async () => {
          await engine.init();
          if (e2eAudioRecoveryDelayMsRef.current > 0) {
            await delay(e2eAudioRecoveryDelayMsRef.current);
          }
        },
        commit: () => {
          const { muted } = useSettingsStore.getState();
          engine.setVolume(muted ? 0 : usePlaybackStore.getState().volume);

          // Rebind metronome only after this stack still owns initialization.
          disposeMetronome();
          if (engine.audioContext) {
            initMetronome(engine.audioContext);
          }

          scheduler.setSong(targetSong);
          scheduler.setSpeed(usePracticeStore.getState().speed);
          scheduler.setMutedTracks(
            getMutedTrackIndices(usePracticeStore.getState().trackPreferences),
          );
          audioReadySongRef.current = targetSong;
          usePlaybackStore.getState().setAudioStatus("ready");
          usePlaybackStore.getState().clearAudioRecovery();
          attemptPendingPlaybackStart();
        },
        cleanupStale: () => {
          engine.setRuntimeErrorHandler(null);
          scheduler.dispose();
          engine.dispose();
          if (audioRef.current === stack) {
            audioRef.current = { engine: null, scheduler: null };
          }
        },
      });
    },
    [attemptPendingPlaybackStart],
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

            const outcome = await recoverLatestPlaybackIntent({
              targetSong: liveSong,
              rebuild: rebuildAudioStack,
              getCurrentSong: () => useSongStore.getState().song,
              getPlaybackIntent: () => {
                const { isPlaying, countInActive, currentTime } =
                  usePlaybackStore.getState();
                return {
                  isPlaying: isPlaying && !countInActive,
                  currentTime,
                };
              },
              getRuntime: () => {
                const { engine, scheduler } = audioRef.current;
                return engine && scheduler ? { engine, scheduler } : null;
              },
            });
            if (outcome === "stale") return;
            const playback = usePlaybackStore.getState();
            if (playback.countInActive) {
              playback.setCountInActive(false);
              playback.setPlaying(false);
              playback.setPlaying(true);
            } else {
              syncCurrentMetronome();
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
    [rebuildAudioStack, syncCurrentMetronome],
  );

  useEffect(() => {
    triggerRecoveryRef.current = recoverAudio;
  }, [recoverAudio]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.api.isE2eTestMode) return;
    const e2eWindow = window as typeof window & {
      __rexianoSetAudioRecoveryDelayFixture?: (delayMs: number) => void;
    };
    e2eWindow.__rexianoSetAudioRecoveryDelayFixture = (delayMs) => {
      e2eAudioRecoveryDelayMsRef.current = Math.max(0, delayMs);
    };
    return () => {
      e2eAudioRecoveryDelayMsRef.current = 0;
      delete e2eWindow.__rexianoSetAudioRecoveryDelayFixture;
    };
  }, []);

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
        audioReadySongRef.current = song;
        usePlaybackStore.getState().setAudioStatus("ready");
        attemptPendingPlaybackStart();
        return;
      }

      try {
        const outcome = await rebuildAudioStack(song);
        if (outcome === "stale") return;
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
    usePracticeStore
      .getState()
      .setMode(
        mapSessionIntentToMode(sessionIntentRef.current, setup.defaultMode),
      );
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
  }, [attemptPendingPlaybackStart, song, rebuildAudioStack]);

  // Sync playback state → AudioScheduler
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
        const { waitMode } = getPracticeEngines();
        if (
          !shouldStartPracticeScheduler({
            mode: usePracticeStore.getState().mode,
            waitState: waitMode?.state ?? null,
          })
        ) {
          return;
        }
        const currentSong = useSongStore.getState().song;
        const metronome = getMetronome();
        const startTransport = (songTime: number): void => {
          // The scheduler must own the clock before AudioContext resumes.
          scheduler.start(songTime);
          void engine.resume().catch((err) => {
            scheduler.stop();
            getMetronome()?.stop();
            usePlaybackStore.getState().setCountInActive(false);
            triggerRecoveryRef.current("resume-failed", err);
          });
        };

        if (currentSong && metronome) {
          const settings = useSettingsStore.getState();
          beginMetronomePlayback({
            engine: metronome,
            song: currentSong,
            currentTime: state.currentTime,
            speed: usePracticeStore.getState().speed,
            metronomeEnabled: settings.metronomeEnabled,
            countInBeats: settings.countInBeats,
            setCountInActive: usePlaybackStore.getState().setCountInActive,
            startTransport,
            getLiveState: () => {
              const playback = usePlaybackStore.getState();
              return {
                song: useSongStore.getState().song,
                isPlaying: playback.isPlaying,
                countInActive: playback.countInActive,
                currentTime: playback.currentTime,
                speed: usePracticeStore.getState().speed,
                metronomeEnabled: useSettingsStore.getState().metronomeEnabled,
              };
            },
          });
        } else {
          startTransport(state.currentTime);
        }
      } else if (!state.isPlaying && prev.isPlaying) {
        scheduler.stop();
        getMetronome()?.stop();
        if (state.countInActive) {
          usePlaybackStore.getState().setCountInActive(false);
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    return registerPlaybackDiscontinuityHandler(({ targetTime, reason }) => {
      const { scheduler, engine } = audioRef.current;
      scheduler?.seek(targetTime);
      const playback = usePlaybackStore.getState();
      rebaseMetronomeDiscontinuity({
        reason,
        targetTime,
        countInActive: playback.countInActive,
        stopCountIn: () => getMetronome()?.stop(),
        setCountInActive: playback.setCountInActive,
        startTransport: (songTime) => {
          if (!scheduler || !engine) return;
          scheduler.start(songTime);
          void engine.resume().catch((err) => {
            scheduler.stop();
            triggerRecoveryRef.current("seek-resume-failed", err);
          });
        },
        syncMetronome: syncCurrentMetronome,
      });
      if (reason === "manual-reset") {
        const { waitMode, scoreCalculator } = getPracticeEngines();
        resetPracticeSession({
          resetWaitMode: () => waitMode?.reset(),
          resetScoreCalculator: () => scoreCalculator?.reset(),
          resetPracticeScore: usePracticeStore.getState().resetScore,
        });
      }
    });
  }, [syncCurrentMetronome]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      audioInitializationOwnerRef.current?.invalidate();
      audioRef.current.engine?.setRuntimeErrorHandler(null);
      audioRef.current.scheduler?.dispose();
      audioRef.current.engine?.dispose();
      if (deviceChangeDebounceRef.current) {
        clearTimeout(deviceChangeDebounceRef.current);
        deviceChangeDebounceRef.current = null;
      }
      disposeMetronome();
      triggerRecoveryRef.current = () => {};
      pendingPlaybackStartSongRef.current = null;
      audioReadySongRef.current = null;
    };
  }, []);

  // Audio clock source for the transport. The scheduler derives song time from
  // AudioContext.currentTime, which stays the master clock for playback.
  const getAudioCurrentTime = useCallback((): number | null => {
    return audioRef.current.scheduler?.getCurrentTime() ?? null;
  }, []);

  // The transport clock advances playback time independently of any view, so
  // playback keeps running in sheet-only mode where no canvas is mounted.
  useEffect(() => {
    const clock = new TransportClock(getAudioCurrentTime);
    clock.start();
    return () => clock.dispose();
  }, [getAudioCurrentTime]);

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

  useEffect(() => {
    const unsub = useSettingsStore.subscribe((state, prev) => {
      if (state.metronomeEnabled === prev.metronomeEnabled) return;
      const engine = getMetronome();
      if (!engine) return;
      const playback = usePlaybackStore.getState();
      if (playback.countInActive) {
        engine.setEnabled(state.metronomeEnabled);
      } else if (playback.isPlaying) {
        syncCurrentMetronome();
      } else {
        engine.setEnabled(state.metronomeEnabled);
        engine.stop();
      }
    });
    return unsub;
  }, [syncCurrentMetronome]);

  useEffect(() => {
    const unsub = usePlaybackStore.subscribe((state, prev) => {
      if (!state.isPlaying || state.countInActive) {
        metronomeSegmentRef.current = null;
        return;
      }
      if (state.currentTime === prev.currentTime) return;
      const currentSong = useSongStore.getState().song;
      if (!currentSong || !useSettingsStore.getState().metronomeEnabled) return;

      const segment = resolveMetronomeSegmentKey(
        currentSong,
        state.currentTime,
        usePracticeStore.getState().speed,
      );
      if (metronomeSegmentRef.current === null) {
        metronomeSegmentRef.current = segment;
      } else if (metronomeSegmentRef.current !== segment) {
        syncCurrentMetronome();
      }
    });
    return unsub;
  }, [syncCurrentMetronome]);

  // ─── Phase 6.5: Startup wiring — speed sync to AudioScheduler ──
  // When practice speed changes, sync the multiplier to the AudioScheduler
  // so audio playback rate matches the visual slow-down.
  useEffect(() => {
    const unsub = usePracticeStore.subscribe((state, prev) => {
      if (state.speed === prev.speed) return;
      audioRef.current.scheduler?.setSpeed(state.speed);
      syncCurrentMetronome();
    });
    return unsub;
  }, [syncCurrentMetronome]);

  // ─── Phase 6: Practice Engine lifecycle (extracted to hook) ──
  const { handleNoteRendererReady, noteRendererRef } = usePracticeLifecycle(
    song,
    audioRef,
    handleWrongPracticeInput,
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

  const prepareAssociatedMidiOpen = useCallback((): void => {
    setSessionIntent("practice");
  }, [setSessionIntent]);

  const {
    importError,
    isDragging,
    handleOpenFile,
    handleLoadMidiPath,
    dismissImportError,
    handleImportRecoveryAction,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  } = useMidiImportActions({
    t,
    loadSong,
    resetPlayback: reset,
    removeRecentFile,
    refreshRecentFiles,
    prepareAssociatedMidiOpen,
  });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !shouldExposeE2eFixtures({
        isE2eTestMode: window.api.isE2eTestMode,
      })
    ) {
      return;
    }

    const e2eWindow = window as typeof window & {
      __rexianoTriggerMissingMidiImport?: (path: string) => Promise<void>;
    };
    e2eWindow.__rexianoTriggerMissingMidiImport = handleLoadMidiPath;
    return () => {
      delete e2eWindow.__rexianoTriggerMissingMidiImport;
    };
  }, [handleLoadMidiPath]);

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
    setSessionIntent("practice");
    applyRoute("library");
  }, [applyRoute, setSessionIntent, t]);

  const isSplitMode = displayMode === "split";
  const viewportHeight = viewportSize.height;
  const isNarrowViewport = viewportSize.width < 640;
  const compactPlaybackChrome = isSplitMode || isNarrowViewport;
  const showTransportBar = !(showEditor && isNarrowViewport);
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
      ref={appShellRef}
      className="app-root-shell app-shell flex h-screen flex-col"
      style={{ color: "var(--color-text)" }}
      inert={showInsights ? true : undefined}
      aria-hidden={showInsights ? "true" : undefined}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {showSceneCurtain && <div className="scene-curtain" />}
      <OnboardingGuide />
      <BluetoothDeviceSelectionDialog />

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

      {/* Import errors are announced but never steal keyboard focus. */}
      {importError && (
        <FileImportErrorAlert
          input={importError.input}
          guidance={importError.guidance}
          onAction={handleImportRecoveryAction}
          onDismiss={dismissImportError}
        />
      )}

      {/* View: Main Menu */}
      {!song && view === "menu" && (
        <>
          <MainMenu
            onStartPractice={() => applyRoute("library")}
            onOpenSettings={() => setShowMenuSettings(true)}
            recentFiles={recentFiles}
            onSelectRecent={(file) => {
              setSessionIntent("practice");
              void handleLoadMidiPath(file.path);
            }}
          />
          {showMenuSettings && (
            <SettingsPanel inline onClose={() => setShowMenuSettings(false)} />
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
            recentFiles={recentFiles}
            onRefreshRecentFiles={refreshRecentFiles}
            onRemoveRecentFile={removeRecentFile}
            onOpenFile={() => {
              setSessionIntent("practice");
              return handleOpenFile();
            }}
            onBack={() => applyRoute("menu")}
            onSessionIntentSelected={setSessionIntent}
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
                  <span className="control-chip playback-header-chip shrink-0">
                    {sessionIntent === "play-along"
                      ? t("playback.session.playAlong")
                      : t("playback.session.practice")}
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
                  ref={insightsTriggerRef}
                  type="button"
                  onClick={() => setShowInsights(true)}
                  className="btn-surface-themed flex min-h-9 min-w-9 items-center justify-center rounded-lg cursor-pointer"
                  title={t("app.insightsTitle")}
                  aria-label={t("app.insightsTitle")}
                  data-testid="insights-trigger"
                >
                  <BarChart3
                    size={15}
                    style={{ color: "var(--color-text)" }}
                    aria-hidden="true"
                  />
                </button>
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
                    <DeviceSelector
                      onBeforeBluetoothConnect={closePlaybackDrawer}
                    />
                  </section>
                  <section className="app-side-section flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (isNarrowViewport) {
                          usePlaybackStore.getState().setPlaying(false);
                        }
                        setShowPlaybackDrawer(false);
                        setShowEditor(true);
                      }}
                      className="btn-surface-themed w-9 h-9 flex items-center justify-center rounded-full cursor-pointer"
                      title={t("editor.open")}
                      aria-label={t("editor.open")}
                      data-testid="open-editor"
                    >
                      <PencilRuler
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
                    tempoMap={notationTempoMap}
                  />
                </div>

                {/* Falling notes canvas. Playback time belongs to
                TransportClock, so this can unmount without stopping the song. */}
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
                  {displayMode !== "sheet" && (
                    <FallingNotesCanvas
                      onActiveNotesChange={handleActiveNotesChange}
                      onNoteRendererReady={handleFallingNoteRendererReady}
                      minHeight={fallingCanvasMinHeight}
                    />
                  )}
                </div>
                <ScoreOverlay />
              </>
            )}
          </div>

          {/* Transport bar */}
          {showTransportBar && <TransportBar compact={compactPlaybackChrome} />}

          {/* Practice toolbar */}
          {!showEditor && <PracticeToolbar compact={compactPlaybackChrome} />}

          {/* Piano keyboard */}
          {!showEditor && (
            <PianoKeyboard
              activeNotes={activeNotes}
              midiActiveNotes={midiActiveNotes}
              missedNotes={wrongNotes}
              height={keyboardHeight}
              compactLabels={compactKeyLabels}
            />
          )}
        </div>
      )}

      {/* Mode selection modal (shown when a song first loads). */}
      {song && showModeModal && (
        <ModeSelectionModal
          defaultMode={modeSelectionDefault}
          onSelect={handleModeSelect}
          onDismiss={handleModeDismiss}
        />
      )}

      {/* Celebration overlay (shown when song ends).
          "Pick Song" leads to StatisticsPage instead of directly back. */}
      {song && showCelebration && (
        <CelebrationOverlay
          score={displayScore}
          visible={showCelebration}
          onPracticeAgain={handlePracticeAgain}
          onChooseSong={handleViewStats}
          songId={songId}
          nextAction={nextPracticeAction}
        />
      )}

      {/* Statistics page (shown after celebration). */}
      {song && showStats && (
        <StatisticsPage
          score={displayScore}
          songName={song.fileName}
          mode={mode}
          speed={speed}
          durationSeconds={Math.round(currentTime)}
          onPlayAgain={handlePracticeAgain}
          onChooseSong={handleChooseSong}
        />
      )}
      {showInsights &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 modal-backdrop-cinematic"
            onClick={(event) => {
              if (event.target === event.currentTarget) closeInsights();
            }}
            data-testid="insights-backdrop"
          >
            <div
              ref={insightsDialogRef}
              className="w-[min(92vw,460px)] max-h-[85vh] overflow-y-auto rounded-2xl modal-card-cinematic subtle-shadow-md"
              role="dialog"
              aria-modal="true"
              aria-labelledby="practice-insights-dialog-title"
              aria-describedby="practice-insights-dialog-description"
              tabIndex={-1}
              data-testid="insights-dialog"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 id="practice-insights-dialog-title" className="sr-only">
                {t("insights.title")}
              </h2>
              <p id="practice-insights-dialog-description" className="sr-only">
                {t("insights.dialogDescription")}
              </p>
              <InsightsPanel
                insight={insight}
                onClose={closeInsights}
                closeButtonRef={insightsCloseButtonRef}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default App;
