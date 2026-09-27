import { useState, useCallback, useRef, useEffect } from "react";
import {
  parseRouteHash,
  resolveRoute,
  routeToHash,
  type AppRoute,
} from "./appRoute";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { getFocusModeExitDecision } from "@renderer/features/practice/focusModeExitGuard";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { PracticeSessionIntent } from "@renderer/features/practice/sessionIntent";
import type { ParsedSong } from "@renderer/engines/midi/types";

export function shouldSyncRouteHash(
  currentHash: string,
  targetHash: string,
): boolean {
  return currentHash !== targetHash;
}

export interface UseAppNavigationOptions {
  song: ParsedSong | null;
}

export interface UseAppNavigationResult {
  view: AppRoute;
  routeIntent: AppRoute;
  sessionIntent: PracticeSessionIntent;
  sessionIntentRef: React.MutableRefObject<PracticeSessionIntent>;
  setSessionIntent: (intent: PracticeSessionIntent) => void;
  applyRoute: (nextRoute: AppRoute) => void;
  showMenuSettings: boolean;
  setShowMenuSettings: (show: boolean) => void;
  showPlaybackDrawer: boolean;
  setShowPlaybackDrawer: (show: boolean) => void;
  closePlaybackDrawer: () => void;
  handleExitPlayback: () => void;
  playbackDrawerRef: React.RefObject<HTMLElement | null>;
  playbackDrawerTriggerRef: React.RefObject<HTMLButtonElement | null>;
  playbackDrawerCloseRef: React.RefObject<HTMLButtonElement | null>;
}

export function useAppNavigation({
  song,
}: UseAppNavigationOptions): UseAppNavigationResult {
  const { t } = useTranslation();
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

  const view: AppRoute = resolveRoute(routeIntent, !!song);
  const [showPlaybackDrawer, setShowPlaybackDrawer] = useState(false);
  const playbackDrawerRef = useRef<HTMLElement | null>(null);
  const playbackDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const playbackDrawerCloseRef = useRef<HTMLButtonElement | null>(null);

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
    if (shouldSyncRouteHash(window.location.hash, targetHash)) {
      window.location.hash = targetHash;
    }
  }, []);

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
    if (shouldSyncRouteHash(window.location.hash, targetHash)) {
      window.history.replaceState(null, "", targetHash);
    }
  }, [view]);

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

    usePlaybackStore.getState().reset();
    useSongStore.getState().clearSong();
    usePracticeStore.getState().resetScore();
    setSessionIntent("practice");
    applyRoute("menu");
  }, [applyRoute, setSessionIntent, t]);

  return {
    view,
    routeIntent,
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
  };
}
