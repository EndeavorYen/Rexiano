import { useCallback, useEffect, useState } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import type { PracticeMode, PracticeScore } from "@shared/types";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { applyPracticeModeChangeForSong } from "./practiceSetupControlActions";

const CELEBRATION_DURATION_MS = 2200;

interface CompletionCelebrationInput {
  wasPlaying: boolean;
  isPlaying: boolean;
  currentTime: number;
  songDuration: number;
  totalNotes: number;
}

interface UsePostSessionFlowOptions {
  song: ParsedSong | null;
  activeTracks: Set<number>;
  speed: number;
  score: PracticeScore;
  onChooseSongRoute: () => void;
}

export interface PostSessionFlowState {
  showModeModal: boolean;
  showCelebration: boolean;
  showStats: boolean;
  completedSessionScore: PracticeScore | null;
  displayScore: PracticeScore;
  handleModeSelect: (mode: PracticeMode) => void;
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
}: CompletionCelebrationInput): boolean {
  return (
    wasPlaying &&
    !isPlaying &&
    totalNotes > 0 &&
    currentTime >= songDuration - 1
  );
}

export function usePostSessionFlow({
  song,
  activeTracks,
  speed,
  score,
  onChooseSongRoute,
}: UsePostSessionFlowOptions): PostSessionFlowState {
  const [showModeModal, setShowModeModal] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [completedSessionScore, setCompletedSessionScore] =
    useState<PracticeScore | null>(null);
  const displayScore = completedSessionScore ?? score;

  useEffect(() => {
    return useSongStore.subscribe((state, prev) => {
      if (state.song !== prev.song && state.song) {
        setShowModeModal(true);
        setShowCelebration(false);
        setShowStats(false);
        setCompletedSessionScore(null);
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
    const timer = setTimeout(() => {
      setShowCelebration(false);
      setShowStats(true);
    }, CELEBRATION_DURATION_MS);
    return () => clearTimeout(timer);
  }, [showCelebration]);

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
      setTimeout(() => {
        usePlaybackStore.getState().setPlaying(true);
      }, 150);
    },
    [activeTracks, song, speed],
  );

  const handlePracticeAgain = useCallback(() => {
    setShowCelebration(false);
    setShowStats(false);
    setCompletedSessionScore(null);
    usePlaybackStore.getState().reset();
    usePracticeStore.getState().resetScore();
  }, []);

  const handleChooseSong = useCallback(() => {
    setShowCelebration(false);
    setShowStats(false);
    setCompletedSessionScore(null);
    useSongStore.getState().clearSong();
    usePlaybackStore.getState().reset();
    onChooseSongRoute();
  }, [onChooseSongRoute]);

  const handleViewStats = useCallback(() => {
    setShowCelebration(false);
    setShowStats(true);
  }, []);

  const hidePostSessionFlow = useCallback(() => {
    setShowModeModal(false);
    setShowCelebration(false);
    setShowStats(false);
    setCompletedSessionScore(null);
  }, []);

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
    handlePracticeAgain,
    handleChooseSong,
    handleViewStats,
    hidePostSessionFlow,
    showCelebrationForScore,
  };
}
