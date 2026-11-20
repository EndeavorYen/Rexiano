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

/** The screens a child can start a song from, and so return to. */
export type BrowseRoute = "menu" | "library";

/** Where leaving playback goes when we never saw a browse screen (#325). */
export const DEFAULT_BROWSE_ROUTE: BrowseRoute = "library";

/** Leaving playback returns to the screen the song was started from. */
export function playbackExitRoute(origin: AppRoute): BrowseRoute {
  return origin === "menu" || origin === "library"
    ? origin
    : DEFAULT_BROWSE_ROUTE;
}

export function shouldSyncRouteHash(
  currentHash: string,
  targetHash: string,
): boolean {
  return currentHash !== targetHash;
}

/**
 * What a hash change means. While a song is on screen, a hash that is not
 * "#/playback" came from the browser's back/forward buttons (our own route
 * changes are tagged and skipped): that is "leave playback", the same as
 * the back arrow in the title bar.
 */
export function decideHashChange(
  hashRoute: AppRoute,
  hasSong: boolean,
  isOwnChange: boolean,
): "exit-playback" | "apply" {
  if (isOwnChange) return "apply";
  return hasSong && hashRoute !== "playback" ? "exit-playback" : "apply";
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
  /** The screen (map or library) the current song was started from */
  getBrowseRoute: () => BrowseRoute;
  showMenuSettings: boolean;
  setShowMenuSettings: (show: boolean) => void;
  showPlaybackDrawer: boolean;
  setShowPlaybackDrawer: (show: boolean) => void;
  closePlaybackDrawer: () => void;
  handleExitPlayback: () => void;
  playbackDrawerRef: React.RefObject<HTMLElement | null>;
  playbackDrawerTriggerRef: React.RefObject<HTMLButtonElement | null>;
  playbackDrawerCloseRef: React.RefObject<HTMLButtonElement | null>;
  /** The stage; closing the drawer gives it the focus so Space keeps working */
  playbackStageRef: React.RefObject<HTMLDivElement | null>;
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
  const browseRouteRef = useRef<BrowseRoute>(DEFAULT_BROWSE_ROUTE);
  useEffect(() => {
    // The last browse screen we showed is where playback returns to.
    if (view !== "playback") browseRouteRef.current = playbackExitRoute(view);
  }, [view]);
  const getBrowseRoute = useCallback(() => browseRouteRef.current, []);
  const [showPlaybackDrawer, setShowPlaybackDrawer] = useState(false);
  const playbackDrawerRef = useRef<HTMLElement | null>(null);
  const playbackDrawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const playbackDrawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const playbackStageRef = useRef<HTMLDivElement | null>(null);

  const closePlaybackDrawer = useCallback(() => {
    setShowPlaybackDrawer(false);
  }, []);

  useDialogFocus({
    active: showPlaybackDrawer,
    containerRef: playbackDrawerRef,
    initialFocusRef: playbackDrawerCloseRef,
    returnFocusRef: playbackStageRef,
    onDismiss: closePlaybackDrawer,
  });

  // The hash we set ourselves; its hashchange event is not the browser's.
  const ownHashRef = useRef<string | null>(null);
  const songRef = useRef<ParsedSong | null>(song);
  useEffect(() => {
    songRef.current = song;
  }, [song]);
  const exitPlaybackRef = useRef<(fromHistory?: boolean) => void>(() => {});

  const applyRoute = useCallback((nextRoute: AppRoute): void => {
    if (nextRoute !== "playback") {
      setShowPlaybackDrawer(false);
    }
    setRouteIntent(nextRoute);
    if (typeof window === "undefined") return;
    const targetHash = routeToHash(nextRoute);
    if (shouldSyncRouteHash(window.location.hash, targetHash)) {
      ownHashRef.current = targetHash;
      window.location.hash = targetHash;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHashChange = (): void => {
      const hash = window.location.hash;
      const route = parseRouteHash(hash);
      const isOwn = ownHashRef.current !== null && ownHashRef.current === hash;
      ownHashRef.current = null;
      if (
        decideHashChange(route, songRef.current !== null, isOwn) ===
        "exit-playback"
      ) {
        exitPlaybackRef.current(true);
        return;
      }
      setRouteIntent(route);
    };
    window.addEventListener("hashchange", onHashChange);
    onHashChange();
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const targetHash = routeToHash(view);
    if (shouldSyncRouteHash(window.location.hash, targetHash)) {
      // Entering playback adds a history entry, so the browser's Back button
      // has somewhere to go: the screen the song was started from.
      if (view === "playback") {
        window.history.pushState(null, "", targetHash);
      } else {
        window.history.replaceState(null, "", targetHash);
      }
    }
  }, [view]);

  const exitPlayback = useCallback(
    (fromHistory = false) => {
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
        // The browser already moved the address; put it back where we are.
        if (fromHistory) {
          window.history.pushState(null, "", routeToHash("playback"));
        }
        return;
      }

      usePlaybackStore.getState().reset();
      useSongStore.getState().clearSong();
      usePracticeStore.getState().resetScore();
      setSessionIntent("practice");
      applyRoute(browseRouteRef.current);
    },
    [applyRoute, setSessionIntent, t],
  );
  useEffect(() => {
    exitPlaybackRef.current = exitPlayback;
  }, [exitPlayback]);
  const handleExitPlayback = useCallback(
    () => exitPlayback(false),
    [exitPlayback],
  );

  return {
    view,
    routeIntent,
    sessionIntent,
    sessionIntentRef,
    setSessionIntent,
    applyRoute,
    getBrowseRoute,
    showMenuSettings,
    setShowMenuSettings,
    showPlaybackDrawer,
    setShowPlaybackDrawer,
    closePlaybackDrawer,
    handleExitPlayback,
    playbackDrawerRef,
    playbackDrawerTriggerRef,
    playbackDrawerCloseRef,
    playbackStageRef,
  };
}
