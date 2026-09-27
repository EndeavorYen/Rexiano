import { useCallback, useRef, useEffect, useMemo } from "react";
import type { ParsedSong } from "@renderer/engines/midi/types";
import { AudioInitializationOwner } from "@renderer/engines/audio/audioInitializationOwnership";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import {
  canStartRequestedPlayback,
  usePostSessionFlow,
} from "./usePostSessionFlow";
import {
  mapSessionIntentToMode,
  type PracticeSessionIntent,
} from "./sessionIntent";
import { resolveSongPracticeSetupForSong } from "./songPracticeSetup";
import type { PracticeMode, PracticeScore } from "@shared/types";
import type { AppRoute } from "../routing/appRoute";

export function resolveDefaultModeForSession(
  song: ParsedSong | null,
  currentMode: PracticeMode,
  sessionIntent: PracticeSessionIntent,
  defaultMode: PracticeMode,
  defaultSpeed: number,
): PracticeMode {
  if (!song) return currentMode;
  return mapSessionIntentToMode(
    sessionIntent,
    resolveSongPracticeSetupForSong(song, {
      defaultMode,
      defaultSpeed,
    }).defaultMode,
  );
}

export interface UsePracticeSessionFlowOptions {
  song: ParsedSong | null;
  sessionIntent: PracticeSessionIntent;
  sessionIntentRef: React.MutableRefObject<PracticeSessionIntent>;
  setSessionIntent: (intent: PracticeSessionIntent) => void;
  applyRoute: (route: AppRoute) => void;
  mode: PracticeMode;
  speed: number;
  activeTracks: Set<number>;
  score: PracticeScore;
}

export interface UsePracticeSessionFlowResult {
  audioInitializationOwnerRef: React.MutableRefObject<AudioInitializationOwner | null>;
  audioReadySongRef: React.MutableRefObject<ParsedSong | null>;
  pendingPlaybackStartSongRef: React.MutableRefObject<ParsedSong | null>;
  attemptPendingPlaybackStart: () => boolean;
  requestPlaybackStart: (requestedSong: ParsedSong) => void;
  cancelPendingPlaybackStart: () => void;
  showModeModal: boolean;
  showCelebration: boolean;
  displayScore: PracticeScore;
  handleModeSelect: (mode: PracticeMode) => void;
  handleModeDismiss: () => void;
  handlePracticeAgain: () => void;
  handleChooseSong: () => void;
  hidePostSessionFlow: () => void;
  showCelebrationForScore: (score: PracticeScore) => void;
  modeSelectionDefault: PracticeMode;
}

export function usePracticeSessionFlow({
  song,
  sessionIntent,
  sessionIntentRef,
  setSessionIntent,
  applyRoute,
  mode,
  speed,
  activeTracks,
  score,
}: UsePracticeSessionFlowOptions): UsePracticeSessionFlowResult {
  const pendingPlaybackStartSongRef = useRef<ParsedSong | null>(null);
  const audioReadySongRef = useRef<ParsedSong | null>(null);
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
    (requestedSong: ParsedSong): void => {
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
    [sessionIntentRef],
  );

  const handleChooseSongRoute = useCallback(() => {
    setSessionIntent("practice");
    applyRoute("library");
  }, [applyRoute, setSessionIntent]);

  const {
    showModeModal,
    showCelebration,
    displayScore,
    handleModeSelect,
    handleModeDismiss,
    handlePracticeAgain,
    handleChooseSong,
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
    const { defaultMode, defaultSpeed } = useSettingsStore.getState();
    return resolveDefaultModeForSession(
      song,
      mode,
      sessionIntent,
      defaultMode,
      defaultSpeed,
    );
  }, [mode, sessionIntent, song]);

  return {
    audioInitializationOwnerRef,
    audioReadySongRef,
    pendingPlaybackStartSongRef,
    attemptPendingPlaybackStart,
    requestPlaybackStart,
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
  };
}
