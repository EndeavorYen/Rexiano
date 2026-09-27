import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useSongStore } from "./stores/useSongStore";
import { usePlaybackStore } from "./stores/usePlaybackStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import { getMetronome } from "./engines/metronome/metronomeManager";
import { FallingNotesCanvas } from "./features/fallingNotes/FallingNotesCanvas";
import { PianoKeyboard } from "./features/fallingNotes/PianoKeyboard";
import { TransportBar } from "./features/fallingNotes/TransportBar";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { SongLibrary } from "./features/songLibrary/SongLibrary";
import { BluetoothDeviceSelectionDialog } from "./features/midiDevice/BluetoothDeviceSelectionDialog";
import { usePracticeLifecycle } from "./features/practice/usePracticeLifecycle";
import { PracticeToolbar } from "./features/practice/PracticeToolbar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTranslation } from "./i18n/useTranslation";
import { SheetMusicPanel } from "./features/sheetMusic/SheetMusicPanel";
import { usePracticeStore } from "./stores/usePracticeStore";
import { MainMenu } from "./features/mainMenu/MainMenu";
import { ModeSelectionModal } from "./features/practice/ModeSelectionModal";
import { CelebrationOverlay } from "./features/practice/CelebrationOverlay";
import { usePracticeSessionFlow } from "./features/practice/usePracticeSessionFlow";
import { useMidiImportActions } from "./features/fileImport/useMidiImportActions";
import { FileImportErrorAlert } from "./features/fileImport/FileImportErrorAlert";
import { buildMidiDiagnosticNotice } from "./features/midiDiagnostics/midiDiagnosticNotice";
import { useRecentFiles } from "./hooks/useRecentFiles";
import {
  calculateSplitLayoutDimensions,
  getMutedTrackIndices,
} from "./features/practice/splitLayoutMath";
import { useAudioPlaybackEngine } from "./features/audio/useAudioPlaybackEngine";
import { usePracticeNotes } from "./features/practice/usePracticeNotes";
import { useAppNavigation } from "./features/routing/useAppNavigation";
import { useAppE2eFixtures } from "./hooks/useAppE2eFixtures";
import { PlaybackHeader } from "./features/practice/PlaybackHeader";
import { PlaybackDrawer } from "./features/practice/PlaybackDrawer";
import { usePracticeInsights } from "./features/practice/usePracticeInsights";
import { useSheetMusicNotation } from "./features/sheetMusic/useSheetMusicNotation";

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

  const {
    view,
    sessionIntent,
    sessionIntentRef,
    setSessionIntent,
    applyRoute,
    showMenuSettings,
    setShowMenuSettings,
    showPlaybackDrawer,
    setShowPlaybackDrawer,
    closePlaybackDrawer,
    handleExitPlayback,
    playbackDrawerRef,
    playbackDrawerTriggerRef,
    playbackDrawerCloseRef,
  } = useAppNavigation({ song });

  const appShellRef = useRef<HTMLDivElement>(null);
  const [showSceneCurtain, setShowSceneCurtain] = useState(false);
  const sceneTokenRef = useRef<string | null>(null);

  useEffect(() => {
    return useSongStore.subscribe((state) => {
      if (!state.song) {
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

  const {
    audioInitializationOwnerRef,
    audioReadySongRef,
    pendingPlaybackStartSongRef,
    attemptPendingPlaybackStart,
    cancelPendingPlaybackStart,
    showModeModal,
    showCelebration,
    displayScore,
    handleModeSelect,
    handleModeDismiss,
    handlePracticeAgain,
    handleChooseSong,
    hidePostSessionFlow,
    showCelebrationForScore,
    modeSelectionDefault,
  } = usePracticeSessionFlow({
    song,
    sessionIntent,
    sessionIntentRef,
    setSessionIntent,
    applyRoute,
    mode,
    speed,
    activeTracks,
    score,
  });

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

  const { songId, nextPracticeAction } = usePracticeInsights({
    song,
    displayScore,
    mode,
    speed,
    activeTracks,
  });

  // ─── Phase 7: Sheet Music ──────────────────────────────
  const displayMode = usePracticeStore((s) => s.displayMode);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const {
    notationData,
    notationTempoMap,
    builtinNotationMetadata,
    setSheetFixtureNotationData,
  } = useSheetMusicNotation({ song });

  const {
    activeNotes,
    midiActiveNotes,
    wrongNotes,
    splitFocusPanel,
    setSplitFocusPanel,
    handleActiveNotesChange,
    handleWrongPracticeInput,
  } = usePracticeNotes();

  const [viewportSize, setViewportSize] = useState(() =>
    typeof window !== "undefined"
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 1440, height: 900 },
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = (): void => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { audioRef } = useAudioPlaybackEngine({
    song,
    sessionIntentRef,
    audioInitializationOwnerRef,
    audioReadySongRef,
    pendingPlaybackStartSongRef,
    attemptPendingPlaybackStart,
  });

  // ─── Practice Engine lifecycle ────────────────────────
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
  }, [audioRef, noteRendererRef]);

  const showFallingNoteLabels = useSettingsStore(
    (s) => s.showFallingNoteLabels,
  );
  const compactKeyLabels = useSettingsStore((s) => s.compactKeyLabels);
  useEffect(() => {
    if (noteRendererRef.current) {
      noteRendererRef.current.showNoteLabels = showFallingNoteLabels;
    }
  }, [showFallingNoteLabels, noteRendererRef]);

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

  useAppE2eFixtures({
    cancelPendingPlaybackStart,
    reset,
    loadSong,
    hidePostSessionFlow,
    applyRoute,
    showCelebrationForScore,
    setSheetFixtureNotationData,
    onTriggerMissingMidiImport: handleLoadMidiPath,
  });

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

  useKeyboardShortcuts({
    onOpenFile: handleOpenFile,
    onToggleMute: handleToggleMute,
  });

  const isSplitMode = displayMode === "split";
  const isNarrowViewport = viewportSize.width < 960;
  const viewportHeight = viewportSize.height;

  const {
    compactPlaybackChrome,
    keyboardHeight,
    splitSheetHeight,
    fallingCanvasMinHeight,
  } = useMemo(
    () =>
      calculateSplitLayoutDimensions({
        viewportHeight,
        isSplitMode,
        isNarrowViewport,
      }),
    [isNarrowViewport, isSplitMode, viewportHeight],
  );

  const splitFocus = isSplitMode ? splitFocusPanel : "sheet";

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
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {showSceneCurtain && <div className="scene-curtain" />}
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

      {/* Import errors */}
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
            onOpenFile={() => {
              setSessionIntent("practice");
              void handleOpenFile();
            }}
            recentFiles={recentFiles}
            onSelectRecent={(file) => {
              setSessionIntent("practice");
              void handleLoadMidiPath(file.path);
            }}
          />
          {showMenuSettings && (
            <SettingsPanel onClose={() => setShowMenuSettings(false)} />
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
          <PlaybackHeader
            songTitle={song.fileName}
            isSplitMode={isSplitMode}
            playbackDrawerTriggerRef={playbackDrawerTriggerRef}
            onOpenPlaybackDrawer={() => setShowPlaybackDrawer(true)}
            onExitPlayback={handleExitPlayback}
            midiDiagnosticNotice={midiDiagnosticNotice}
          />

          <PlaybackDrawer
            show={showPlaybackDrawer}
            drawerRef={playbackDrawerRef}
            closeRef={playbackDrawerCloseRef}
            onClose={closePlaybackDrawer}
          />

          {/* Main display area: sheet music / falling notes */}
          <div
            className={`workspace-frame ${isPlaying ? "workspace-frame-live" : ""} flex-1 relative flex flex-col min-h-0 surface-panel overflow-hidden`}
          >
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
                tempoMap={notationTempoMap}
              />
            </div>

            <div
              data-testid="falling-notes-panel"
              className="flex-1 min-h-0 relative flex flex-col"
              style={{
                display: "flex",
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
                onNoteRendererReady={handleFallingNoteRendererReady}
                minHeight={fallingCanvasMinHeight}
              />
            </div>
          </div>

          <TransportBar compact={compactPlaybackChrome} />
          <PracticeToolbar compact={compactPlaybackChrome} />

          <PianoKeyboard
            activeNotes={activeNotes}
            midiActiveNotes={midiActiveNotes}
            missedNotes={wrongNotes}
            height={keyboardHeight}
            compactLabels={compactKeyLabels}
          />
        </div>
      )}

      {/* Mode selection modal */}
      {song && showModeModal && (
        <ModeSelectionModal
          defaultMode={modeSelectionDefault}
          onSelect={handleModeSelect}
          onDismiss={handleModeDismiss}
        />
      )}

      {/* Celebration overlay */}
      {song && showCelebration && (
        <CelebrationOverlay
          score={displayScore}
          visible={showCelebration}
          onPracticeAgain={handlePracticeAgain}
          onChooseSong={handleChooseSong}
          songId={songId}
          nextAction={nextPracticeAction}
          mode={mode}
        />
      )}
    </div>
  );
}

export default App;
