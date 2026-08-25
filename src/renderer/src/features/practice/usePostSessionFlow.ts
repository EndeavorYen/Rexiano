import { useCallback, useEffect, useRef, useState } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { PracticeMode, PracticeScore } from "@shared/types";
import type { AudioEngineStatus } from "@renderer/engines/audio/types";
import { getPracticeEngines } from "@renderer/engines/practice/practiceManager";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { applyPracticeModeChangeForSong } from "./practiceSetupControlActions";
import type { PracticeSessionIntent } from "./sessionIntent";
import { shouldPromptForPracticeMode } from "./sessionIntent";

const CELEBRATION_DURATION_MS = 2200;

interface CompletionCelebrationInput {
  wasPlaying: boolean;
  isPlaying: boolean;
  currentTime: number;
  songDuration: number;
  totalNotes: number;
  mode?: PracticeMode;
}

interface UsePostSessionFlowOptions {
  song: ParsedSong | null;
  sessionIntent: PracticeSessionIntent;
  getSessionIntent?: () => PracticeSessionIntent;
  activeTracks: Set<number>;
  speed: number;
  score: PracticeScore;
  onChooseSongRoute: () => void;
  onRequestPlaybackStart: (song: ParsedSong) => void;
  onCancelPendingPlaybackStart: () => void;
}

interface ModeSelectionInput {
  nextHasSong: boolean;
  intent: PracticeSessionIntent;
}

export interface PostSessionFlowState {
  showModeModal: boolean;
  showCelebration: boolean;
  showStats: boolean;
  completedSessionScore: PracticeScore | null;
  displayScore: PracticeScore;
  handleModeSelect: (mode: PracticeMode) => void;
  handleModeDismiss: () => void;
  handlePracticeAgain: () => void;
  handleChooseSong: () => void;
  handleViewStats: () => void;
  hidePostSessionFlow: () => void;
  showCelebrationForScore: (score: PracticeScore) => void;
}

export function shouldShowCompletionCelebration({
  wasPlaying,
  isPlaying,
  currentTime,
  songDuration,
  totalNotes,
  mode,
}: CompletionCelebrationInput): boolean {
  const endedNearClose =
    wasPlaying &&
    !isPlaying &&
    songDuration > 0 &&
    currentTime >= songDuration - 1;
  if (!endedNearClose) return false;
  if (mode === "watch") return true;
  return totalNotes > 0;
}

export function shouldAdvanceCelebrationToStats(mode: PracticeMode): boolean {
  return mode !== "watch";
}

export function shouldShowModeSelectionModal({
  nextHasSong,
  intent,
}: ModeSelectionInput): boolean {
  return nextHasSong && shouldPromptForPracticeMode(intent);
}

interface RequestedPlaybackInput<T> {
  requestedSong: T | null;
  currentSong: T | null;
  readySong: T | null;
  audioStatus: AudioEngineStatus;
}

export function canStartRequestedPlayback<T>({
  requestedSong,
  currentSong,
  readySong,
  audioStatus,
}: RequestedPlaybackInput<T>): boolean {
  return (
    requestedSong !== null &&
    requestedSong === currentSong &&
    requestedSong === readySong &&
    audioStatus === "ready"
  );
}

interface PracticeDismissalActions {
  cancelPendingPlaybackStart: () => void;
  hidePostSession: () => void;
  resetPlayback: () => void;
  clearSong: () => void;
  routeToLibrary: () => void;
}

export function runPracticeDismissal(actions: PracticeDismissalActions): void {
  actions.cancelPendingPlaybackStart();
  actions.hidePostSession();
  actions.resetPlayback();
  actions.clearSong();
  actions.routeToLibrary();
}

interface PracticeRetryActions {
  hidePostSession: () => void;
  resetPlayback: () => void;
  resetWaitMode: () => void;
  resetScoreCalculator: () => void;
  resetPracticeScore: () => void;
  requestPlaybackStart: () => void;
}

export function runPracticeRetry(actions: PracticeRetryActions): void {
  actions.hidePostSession();
  actions.resetPlayback();
  actions.resetWaitMode();
  actions.resetScoreCalculator();
  actions.resetPracticeScore();
  actions.requestPlaybackStart();
}

export function usePostSessionFlow({
  song,
  sessionIntent,
  getSessionIntent,
  activeTracks,
  speed,
  score,
  onChooseSongRoute,
  onRequestPlaybackStart,
  onCancelPendingPlaybackStart,
}: UsePostSessionFlowOptions): PostSessionFlowState {
  const sessionIntentRef = useRef(sessionIntent);
  const getSessionIntentRef = useRef(getSessionIntent);
  const [showModeModal, setShowModeModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [completedSessionScore, setCompletedSessionScore] =
    useState<PracticeScore | null>(null);
  const displayScore = completedSessionScore ?? score;

  useEffect(() => {
    sessionIntentRef.current = sessionIntent;
    getSessionIntentRef.current = getSessionIntent;
  }, [getSessionIntent, sessionIntent]);

  useEffect(() => {
    return useSongStore.subscribe((state, prev) => {
      if (state.song !== prev.song) {
        setShowModeModal(
          shouldShowModeSelectionModal({
            nextHasSong: state.song !== null,
            intent: getSessionIntentRef.current?.() ?? sessionIntentRef.current,
          }),
        );
        if (state.song) {
          setShowCelebration(false);
          setShowStats(false);
          setCompletedSessionScore(null);
        }
      }
    });
  }, []);

  useEffect(() => {
    return usePlaybackStore.subscribe((state, prev) => {
      const currentSong = useSongStore.getState().song;
      const currentScore = usePracticeStore.getState().score;
      if (
        currentSong &&
        shouldShowCompletionCelebration({
          wasPlaying: prev.isPlaying,
          isPlaying: state.isPlaying,
          currentTime: state.currentTime,
          songDuration: currentSong.duration,
          totalNotes: currentScore.totalNotes,
          mode: usePracticeStore.getState().mode,
        })
      ) {
        setCompletedSessionScore(currentScore);
        setShowCelebration(true);
        setShowStats(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!showCelebration) return;
    if (!shouldAdvanceCelebrationToStats(usePracticeStore.getState().mode)) {
      return;
    }
    const timer = setTimeout(() => {
      setShowCelebration(false);
      setShowStats(true);
    }, CELEBRATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showCelebration]);

  const resetPostSessionState = useCallback(() => {
    setShowModeModal(false);
    setShowCelebration(false);
    setShowStats(false);
    setCompletedSessionScore(null);
  }, []);

  const handleModeSelect = useCallback(
    (mode: PracticeMode) => {
      applyPracticeModeChangeForSong(
        {
          song,
          activeTracks,
          currentSpeed: speed,
          setMode: usePracticeStore.getState().setMode,
        },
        mode,
      );
      setShowModeModal(false);
      const selectedSong = useSongStore.getState().song;
      if (selectedSong) {
        onRequestPlaybackStart(selectedSong);
      }
    },
    [activeTracks, onRequestPlaybackStart, song, speed],
  );

  const handlePracticeAgain = useCallback(() => {
    const retrySong = useSongStore.getState().song;
    const { waitMode, scoreCalculator } = getPracticeEngines();
    runPracticeRetry({
      hidePostSession: resetPostSessionState,
      resetPlayback: usePlaybackStore.getState().reset,
      resetWaitMode: () => waitMode?.reset(),
      resetScoreCalculator: () => scoreCalculator?.reset(),
      resetPracticeScore: usePracticeStore.getState().resetScore,
      requestPlaybackStart: () => {
        if (retrySong) onRequestPlaybackStart(retrySong);
      },
    });
  }, [onRequestPlaybackStart, resetPostSessionState]);

  const dismissToLibrary = useCallback(() => {
    runPracticeDismissal({
      cancelPendingPlaybackStart: onCancelPendingPlaybackStart,
      hidePostSession: resetPostSessionState,
      resetPlayback: usePlaybackStore.getState().reset,
      clearSong: useSongStore.getState().clearSong,
      routeToLibrary: onChooseSongRoute,
    });
  }, [onCancelPendingPlaybackStart, onChooseSongRoute, resetPostSessionState]);

  const handleChooseSong = dismissToLibrary;

  const handleViewStats = useCallback(() => {
    setShowCelebration(false);
    setShowStats(true);
  }, []);

  const hidePostSessionFlow = resetPostSessionState;

  const showCelebrationForScore = useCallback((score: PracticeScore) => {
    setCompletedSessionScore(score);
    setShowModeModal(false);
    setShowCelebration(true);
    setShowStats(false);
  }, []);

  return {
    showModeModal,
    showCelebration,
    showStats,
    completedSessionScore,
    displayScore,
    handleModeSelect,
    handleModeDismiss: dismissToLibrary,
    handlePracticeAgain,
    handleChooseSong,
    handleViewStats,
    hidePostSessionFlow,
    showCelebrationForScore,
  };
}
