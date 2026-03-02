import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ArrowLeft, BarChart3, PanelRightOpen, X } from "lucide-react";
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
import { InsightsPanel } from "./features/insights/InsightsPanel";
import { WeakSpotAnalyzer } from "./features/insights/WeakSpotAnalyzer";
import type { SessionSummary } from "./features/insights/WeakSpotAnalyzer";
import { useMidiDeviceStore } from "./stores/useMidiDeviceStore";
import { usePracticeLifecycle } from "./features/practice/usePracticeLifecycle";
import { PracticeToolbar } from "./features/practice/PracticeToolbar";
import { ScoreOverlay } from "./features/practice/ScoreOverlay";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTranslation } from "./i18n/useTranslation";
import { SheetMusicPanel } from "./features/sheetMusic/SheetMusicPanel";
import { DisplayModeToggle } from "./features/sheetMusic/DisplayModeToggle";
import { convertToNotation } from "./features/sheetMusic/MidiToNotation";
import { getCursorPosition } from "./features/sheetMusic/CursorSync";
import { usePracticeStore } from "./stores/usePracticeStore";
import { MainMenu } from "./features/mainMenu/MainMenu";
import { ModeSelectionModal } from "./features/practice/ModeSelectionModal";
import { CelebrationOverlay } from "./features/practice/CelebrationOverlay";
import { StatisticsPage } from "./features/statistics/StatisticsPage";
import type { PracticeMode } from "@shared/types";
import {
  parseRouteHash,
  resolveRoute,
  routeToHash,
  type AppRoute,
} from "./features/routing/appRoute";

/** Accepted file extensions for drag-and-drop MIDI import */
const MIDI_EXTENSIONS = [".mid", ".midi"];
const CELEBRATION_DURATION_MS = 2200;

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

  // ─── Mode selection + celebration + stats flow ────────
  const [showModeModal, setShowModeModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const mode = usePracticeStore((s) => s.mode);
  const speed = usePracticeStore((s) => s.speed);
  const score = usePracticeStore((s) => s.score);

  // Show mode selection when a new song loads (subscribe pattern avoids
  // calling setState directly in an effect body).
  useEffect(() => {
    return useSongStore.subscribe((state, prev) => {
      if (state.song !== prev.song && state.song) {
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
          state.currentTime >= currentSong.duration - 1
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

  const handleModeSelect = useCallback((mode: PracticeMode) => {
    usePracticeStore.getState().setMode(mode);
    setShowModeModal(false);
    setTimeout(() => {
      usePlaybackStore.getState().setPlaying(true);
    }, 150);
  }, []);

  const handlePracticeAgain = useCallback(() => {
    setShowCelebration(false);
    setShowStats(false);
    usePlaybackStore.getState().reset();
    usePracticeStore.getState().resetScore();
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
  const songId = song?.fileName ?? "";

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

  // ─── Phase 7: Sheet Music ──────────────────────────────
  const displayMode = usePracticeStore((s) => s.displayMode);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);

  const notationData = useMemo(() => {
    if (!song) return null;
    const allNotes = song.tracks.flatMap((tr) => tr.notes);
    const bpm = song.tempos.length > 0 ? song.tempos[0].bpm : 120;
    return convertToNotation(allNotes, bpm);
  }, [song]);

  const cursorPosition = useMemo(() => {
    if (!notationData) return null;
    return getCursorPosition(currentTime, notationData);
  }, [notationData, currentTime]);
  // ─── End Phase 7 ──────────────────────────────────────

  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const midiActiveNotes = useMidiDeviceStore((s) => s.activeNotes);

  const handleActiveNotesChange = useCallback((notes: Set<number>) => {
    setActiveNotes(notes);
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
  // ─── End Phase 6 ─────────────────────────────────────

  // ─── Phase 6.5: Startup wiring — showFallingNoteLabels ─
  // Sync the falling note label setting to NoteRenderer whenever it changes.
  const showFallingNoteLabels = useSettingsStore(
    (s) => s.showFallingNoteLabels,
  );
  useEffect(() => {
    if (noteRendererRef.current) {
      noteRendererRef.current.showNoteLabels = showFallingNoteLabels;
    }
  }, [showFallingNoteLabels, noteRendererRef]);
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

  // ─── Phase 6.5: Drag-and-drop MIDI import ──────────────
  const [isDragging, setIsDragging] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const dragCountRef = useRef(0);

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
        setTimeout(() => setDragError(null), 3000);
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
          setTimeout(() => setDragError(null), 3000);
        }
      };
      reader.onerror = () => {
        setDragError(t("app.failedRead"));
        setTimeout(() => setDragError(null), 3000);
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
  const splitSheetHeight = isSplitMode ? 216 : undefined;
  const fallingCanvasMinHeight = isSplitMode ? 120 : 200;
  const keyboardHeight = isSplitMode ? 84 : 100;
  const speedPercent = Math.round(speed * 100);
  const baseBpm =
    song?.tempos && song.tempos.length > 0
      ? Math.round(song.tempos[0].bpm)
      : null;
  const effectiveBpm =
    baseBpm !== null ? Math.max(1, Math.round(baseBpm * speed)) : null;

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
      {dragError && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-body subtle-shadow"
          style={{
            background: "#dc2626",
            color: "#ffffff",
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
        >
          <div
            className={`surface-panel subtle-shadow ${
              isSplitMode ? "px-2.5 py-2 mb-2" : "px-3 py-2.5 mb-2.5"
            }`}
            style={{
              borderRadius: "1.1rem",
            }}
            data-testid="playback-header-panel"
          >
            <div className="flex items-center gap-2 justify-between min-w-0">
              <div
                className="min-w-0 flex-1 flex flex-wrap items-center gap-1.25"
                data-testid="playback-title-meta-row"
              >
                <span className="kicker-label shrink-0">
                  {t("app.subtitle")}
                </span>
                <h2
                  className="font-semibold font-body truncate text-[0.98rem] max-w-[34vw]"
                  data-testid="playback-song-title"
                >
                  {song.fileName}
                </h2>

                <div
                  className="flex flex-wrap items-center gap-1"
                  data-testid="playback-header-chips"
                >
                  <span className="control-chip playback-header-chip">
                    {song.tracks.length}{" "}
                    {song.tracks.length > 1
                      ? t("song.tracks")
                      : t("song.track")}
                  </span>
                  <span className="control-chip playback-header-chip">
                    {song.noteCount} {t("song.notes")}
                  </span>
                  <span className="control-chip playback-header-chip font-mono tabular-nums">
                    {speedPercent}%
                  </span>
                  {effectiveBpm !== null && (
                    <span className="control-chip playback-header-chip font-mono tabular-nums">
                      {effectiveBpm} BPM
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setShowPlaybackDrawer(true)}
                  className="btn-surface-themed flex items-center gap-1.5 rounded-lg font-body cursor-pointer px-2 py-1 text-[11px]"
                  data-testid="playback-drawer-trigger"
                >
                  <PanelRightOpen size={13} />
                  {t("settings.title")}
                </button>
                <button
                  onClick={handleExitPlayback}
                  className="btn-surface-themed flex items-center gap-1.5 rounded-lg font-body cursor-pointer px-2 py-1 text-[11px]"
                >
                  <ArrowLeft size={13} />
                  {t("song.backToLibrary")}
                </button>
              </div>
            </div>
          </div>

          {showPlaybackDrawer && (
            <div
              className="app-overlay-backdrop"
              onClick={() => setShowPlaybackDrawer(false)}
            >
              <aside
                className="app-side-drawer"
                onClick={(e) => e.stopPropagation()}
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
            <SheetMusicPanel
              notationData={notationData}
              cursorPosition={cursorPosition}
              mode={displayMode}
              height={splitSheetHeight}
            />

            {/* Falling notes canvas — always mounted so PixiJS ticker keeps
                running (WaitMode relies on it). Hidden via CSS in sheet mode. */}
            <div
              className="flex-1 min-h-0 relative flex flex-col"
              style={{ display: displayMode === "sheet" ? "none" : "flex" }}
            >
              <FallingNotesCanvas
                onActiveNotesChange={handleActiveNotesChange}
                getAudioCurrentTime={getAudioCurrentTime}
                onNoteRendererReady={handleNoteRendererReady}
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
          <TransportBar compact={isSplitMode} />

          {/* Practice toolbar */}
          <PracticeToolbar compact={isSplitMode} />

          {/* Piano keyboard */}
          <PianoKeyboard
            activeNotes={activeNotes}
            midiActiveNotes={midiActiveNotes}
            height={keyboardHeight}
          />

          {/* Mode selection modal (shown when a song first loads) */}
          {showModeModal && <ModeSelectionModal onSelect={handleModeSelect} />}

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
              songId={songId}
            />
          )}

          {/* Statistics page (shown after celebration) */}
          {showStats && (
            <StatisticsPage
              score={score}
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
