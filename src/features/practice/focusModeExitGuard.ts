export interface FocusModeExitInput {
  childFocusMode: boolean;
  isPlaying: boolean;
  hasSong: boolean;
}

export interface FocusModeExitDecision {
  confirmBeforeExit: boolean;
  pauseBeforeConfirm: boolean;
}

export function getFocusModeExitDecision({
  childFocusMode,
  isPlaying,
  hasSong,
}: FocusModeExitInput): FocusModeExitDecision {
  const shouldGuard = hasSong && childFocusMode && isPlaying;
  return {
    confirmBeforeExit: shouldGuard,
    pauseBeforeConfirm: shouldGuard,
  };
}
