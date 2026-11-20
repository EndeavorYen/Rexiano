import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { List, Upload } from "lucide-react";
import { displayTitleForName } from "@renderer/features/songLibrary/songTitle";
import { useSongLibraryStore } from "@renderer/stores/useSongLibraryStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import { FamilyTopBar } from "../shell/FamilyTopBar";
import { PianoQuickConnect } from "../midiDevice/PianoQuickConnect";
import { buildLessonProgression } from "../songLibrary/lessonProgression";
import { openBuiltinSong } from "../songLibrary/openBuiltinSong";
import { buildSongActivity } from "../songLibrary/songLibrarySelectors";
import { buildDailyGoalStatus } from "../practice/nextPracticeAction";
import type { PracticeSessionIntent } from "../practice/sessionIntent";
import type { RecentFile } from "@shared/types";
import { AdventureMap } from "./AdventureMap";
import { buildAdventureMap } from "./adventureMap";
import { buildPracticeCalendar } from "./practiceCalendar";
import { HomeStatsBar } from "./HomeStatsBar";
import "./home-map.css";

const DAILY_GOAL_MINUTES = 10;
const MAX_IMPORTED_RECENTS = 3;

interface MainMenuProps {
  onStartPractice: () => void;
  onOpenSettings: () => void;
  onOpenFile?: () => void;
  onSelectRecent?: (file: RecentFile) => void;
  /** Called with "practice" just before a song opens from the map */
  onSessionIntentSelected?: (intent: PracticeSessionIntent) => void;
  onRefreshRecentFiles?: () => void;
  recentFiles: RecentFile[];
}

/**
 * Home screen: the practice route. Every built-in song is a station along a
 * winding road, grouped by lesson unit; the next stop is preselected.
 */
export function MainMenu({
  onStartPractice,
  onOpenSettings,
  onOpenFile,
  onSelectRecent,
  onSessionIntentSelected,
  onRefreshRecentFiles,
  recentFiles: allRecents,
}: MainMenuProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const songs = useSongLibraryStore((s) => s.songs);
  const sessions = useProgressStore((s) => s.sessions);
  const isProgressLoaded = useProgressStore((s) => s.isLoaded);
  const loadSessions = useProgressStore((s) => s.loadSessions);
  const loadSong = useSongStore((s) => s.loadSong);
  const resetPlayback = usePlaybackStore((s) => s.reset);
  const [loadingSongId, setLoadingSongId] = useState<string | null>(null);

  useEffect(() => {
    const library = useSongLibraryStore.getState();
    if (library.songs.length === 0 && !library.isLoading) {
      void library.fetchSongs();
    }
  }, []);

  useEffect(() => {
    if (!isProgressLoaded) {
      void loadSessions();
    }
  }, [isProgressLoaded, loadSessions]);

  // One model for the whole screen: stations do not subscribe on their own.
  const model = useMemo(() => {
    const activity = buildSongActivity(songs, sessions, allRecents, []);
    return buildAdventureMap(buildLessonProgression(songs, activity));
  }, [songs, sessions, allRecents]);

  const goal = useMemo(
    () =>
      buildDailyGoalStatus(sessions, {
        dayTimestamp: Date.now(),
        targetMinutes: DAILY_GOAL_MINUTES,
      }),
    [sessions],
  );
  const calendar = useMemo(() => buildPracticeCalendar(sessions), [sessions]);

  const importedRecents = useMemo(
    () =>
      allRecents
        .filter((file) => !file.path.startsWith("builtin:"))
        .slice(0, MAX_IMPORTED_RECENTS),
    [allRecents],
  );
  const showRecents = importedRecents.length > 0 && !!onSelectRecent;

  const handlePlay = useCallback(
    async (songId: string) => {
      onSessionIntentSelected?.("practice");
      setLoadingSongId(songId);
      try {
        const title = await openBuiltinSong(songId, {
          loadSong,
          resetPlayback,
        });
        if (title) onRefreshRecentFiles?.();
      } catch (error) {
        console.error("Failed to load built-in song:", error);
      } finally {
        setLoadingSongId(null);
      }
    },
    [loadSong, onRefreshRecentFiles, onSessionIntentSelected, resetPlayback],
  );

  const entries = (
    <>
      <button
        type="button"
        onClick={onStartPractice}
        className="btn-ghost-themed"
        data-testid="main-menu-library"
        data-import-recovery-focus-fallback
      >
        <List size={18} aria-hidden="true" />
        {t("map.allSongs")}
      </button>
      {onOpenFile && (
        <button
          type="button"
          onClick={onOpenFile}
          className="btn-ghost-themed"
          data-testid="main-menu-import"
        >
          <Upload size={18} aria-hidden="true" />
          {t("library.importMidi")}
        </button>
      )}
    </>
  );

  const ready = model.stations.length > 0;
  const firstRun = ready && !model.hasAnyProgress;

  return (
    <div
      ref={scrollerRef}
      className="flex-1 min-h-0 overflow-y-auto"
      data-testid="main-menu-scroller"
    >
      <div className="hm-page animate-page-enter">
        <FamilyTopBar
          onOpenSettings={onOpenSettings}
          settingsTestId="main-menu-settings"
        />

        <section className="hm-hud" aria-label={t("map.hudLabel")}>
          <HomeStatsBar
            goal={goal}
            calendar={calendar}
            totalStars={model.totalStars}
            maxStars={model.maxStars}
          />
          <PianoQuickConnect
            onOpenDetails={onOpenSettings}
            testId="main-menu-piano"
            quiet
          />
          {firstRun && (
            <div className="set-card hm-invite" data-testid="map-first-invite">
              <div>
                <h2 className="m-0 text-base font-bold">
                  {t("map.firstInvite")}
                </h2>
                <p
                  className="m-0 text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {t("map.firstInviteHint")}
                </p>
              </div>
            </div>
          )}
        </section>

        {showRecents && (
          <section
            className="hm-recents"
            aria-label={t("map.recentLabel")}
            data-testid="main-menu-recents"
          >
            <span className="hm-recents-label">
              {t("library.recentlyPlayed")}
            </span>
            {importedRecents.map((file) => {
              const title = displayTitleForName(file.name, songs, lang);
              return (
                <button
                  key={file.path}
                  type="button"
                  className="btn-surface-themed hm-recent"
                  title={title}
                  onClick={() => onSelectRecent(file)}
                >
                  <span>{title}</span>
                </button>
              );
            })}
          </section>
        )}

        {ready ? (
          <AdventureMap
            model={model}
            scrollerRef={scrollerRef}
            loadingSongId={loadingSongId}
            onPlay={(songId) => void handlePlay(songId)}
            toolbar={entries}
          />
        ) : (
          <>
            <div className="hm-units-row">
              <span />
              <div className="hm-entries">{entries}</div>
            </div>
            <div
              className="hm-skeleton"
              role="status"
              aria-label={t("map.loading")}
            />
          </>
        )}
      </div>
    </div>
  );
}
