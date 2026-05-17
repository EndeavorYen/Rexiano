import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import {
  Upload,
  AlertCircle,
  Music,
  Trophy,
  Flame,
  ArrowLeft,
  PanelRightOpen,
  X,
  PlayCircle,
  Star,
  Target,
} from "lucide-react";
import { parseMidiFile } from "../../engines/midi/MidiFileParser";
import { useSongStore } from "../../stores/useSongStore";
import { usePlaybackStore } from "../../stores/usePlaybackStore";
import { useSongLibraryStore } from "../../stores/useSongLibraryStore";
import { useProgressStore } from "../../stores/useProgressStore";
import { useRecentFiles } from "../../hooks/useRecentFiles";
import { formatRelativeTime } from "../../utils/relativeTime";
import { SongCard } from "./SongCard";
import { SongLibraryFilters } from "./SongLibraryFilters";
import { ThemePicker } from "../settings/ThemePicker";
import {
  categoryLabels,
  getGradeColor,
  gradeLabelShort,
  groupSongsByCategory,
} from "./songCardUtils";
import {
  buildPracticeRecommendationModel,
  buildSongActivity,
  filterSongsForLibrary,
  sortSongsForLibrary,
  type PracticeRecommendationReason,
  type SongActivity,
} from "./songLibrarySelectors";
import {
  getRecentFileRecovery,
  type RecentFileRecovery,
} from "./recentFileRecovery";
import {
  buildLessonProgression,
  type LessonRecommendationReason,
} from "./lessonProgression";
import { DeviceSelector } from "../midiDevice/DeviceSelector";
import { useTranslation } from "../../i18n/useTranslation";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { buildDailyGoalStatus } from "../practice/nextPracticeAction";
import appIcon from "../../../../../docs/figure/Rexiano_icon.png";
import type { BuiltinSongMeta, RecentFile } from "../../../../shared/types";
import type { TranslationKey } from "../../i18n/types";

interface SongLibraryProps {
  onOpenFile: () => Promise<void>;
  onBack?: () => void;
}

const emptyActivity: SongActivity = {
  isFavorite: false,
  lastPlayedAt: null,
  playCount: 0,
  bestAccuracy: null,
};

const recommendationReasonKeys: Record<
  PracticeRecommendationReason,
  TranslationKey
> = {
  "new-song": "library.recommendation.reason.newSong",
  "improve-score": "library.recommendation.reason.improveScore",
  "continue-progress": "library.recommendation.reason.continueProgress",
};

const lessonRecommendationReasonKeys: Record<
  LessonRecommendationReason,
  TranslationKey
> = {
  "new-song": "library.recommendation.reason.newSong",
  "improve-score": "library.recommendation.reason.improveScore",
  "continue-progress": "library.recommendation.reason.continueProgress",
};

export function SongLibrary({
  onOpenFile,
  onBack,
}: SongLibraryProps): React.JSX.Element {
  const { t } = useTranslation();

  /** Warm greetings that rotate based on time of day */
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("library.greeting.morning");
    if (hour < 17) return t("library.greeting.afternoon");
    return t("library.greeting.evening");
  }, [t]);
  const songs = useSongLibraryStore((s) => s.songs);
  const isLoading = useSongLibraryStore((s) => s.isLoading);
  const searchQuery = useSongLibraryStore((s) => s.searchQuery);
  const difficultyFilter = useSongLibraryStore((s) => s.difficultyFilter);
  const gradeFilter = useSongLibraryStore((s) => s.gradeFilter);
  const sortMode = useSongLibraryStore((s) => s.sortMode);
  const viewMode = useSongLibraryStore((s) => s.viewMode);
  const favoriteSongIds = useSongLibraryStore((s) => s.favoriteSongIds);
  const fetchSongs = useSongLibraryStore((s) => s.fetchSongs);
  const toggleFavoriteSong = useSongLibraryStore((s) => s.toggleFavoriteSong);

  const loadSong = useSongStore((s) => s.loadSong);
  const reset = usePlaybackStore((s) => s.reset);

  const sessions = useProgressStore((s) => s.sessions);
  const isProgressLoaded = useProgressStore((s) => s.isLoaded);
  const loadSessions = useProgressStore((s) => s.loadSessions);

  const {
    recentFiles,
    refresh: refreshRecents,
    remove: removeRecent,
  } = useRecentFiles();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentRecovery, setRecentRecovery] =
    useState<RecentFileRecovery | null>(null);
  const [loadingRecentPath, setLoadingRecentPath] = useState<string | null>(
    null,
  );
  const [showDeviceDrawer, setShowDeviceDrawer] = useState(false);
  const deviceDrawerRef = useRef<HTMLElement>(null);
  const deviceDrawerTriggerRef = useRef<HTMLButtonElement>(null);
  const deviceDrawerCloseRef = useRef<HTMLButtonElement>(null);
  const closeDeviceDrawer = useCallback(() => {
    setShowDeviceDrawer(false);
  }, []);

  useDialogFocus({
    active: showDeviceDrawer,
    containerRef: deviceDrawerRef,
    initialFocusRef: deviceDrawerCloseRef,
    returnFocusRef: deviceDrawerTriggerRef,
    onDismiss: closeDeviceDrawer,
  });

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    if (!isProgressLoaded) {
      loadSessions();
    }
  }, [isProgressLoaded, loadSessions]);

  const filteredSongs = useMemo(() => {
    return filterSongsForLibrary(songs, {
      difficultyFilter,
      gradeFilter,
      searchQuery,
    });
  }, [songs, difficultyFilter, gradeFilter, searchQuery]);

  const songActivity = useMemo(
    () => buildSongActivity(songs, sessions, recentFiles, favoriteSongIds),
    [songs, sessions, recentFiles, favoriteSongIds],
  );

  const sortedSongs = useMemo(
    () => sortSongsForLibrary(filteredSongs, songActivity, sortMode),
    [filteredSongs, songActivity, sortMode],
  );

  const practiceRecommendation = useMemo(
    () => buildPracticeRecommendationModel(filteredSongs, songActivity),
    [filteredSongs, songActivity],
  );

  const lessonProgression = useMemo(
    () => buildLessonProgression(songs, songActivity),
    [songs, songActivity],
  );
  const nextLesson = lessonProgression.nextLesson;

  const dailyGoalStatus = useMemo(
    () =>
      buildDailyGoalStatus(sessions, {
        dayTimestamp: Date.now(),
        targetMinutes: 10,
      }),
    [sessions],
  );

  /** Songs grouped by category for section display */
  const categoryGroups = useMemo(
    () => groupSongsByCategory(sortedSongs),
    [sortedSongs],
  );

  /** Progress stats derived from sessions */
  const progressStats = useMemo(() => {
    const uniqueSongs = new Set(sessions.map((s) => s.songId)).size;
    const totalSessions = sessions.length;
    const bestAccuracy =
      sessions.length > 0
        ? Math.round(Math.max(...sessions.map((s) => s.score.accuracy)))
        : 0;
    return { uniqueSongs, totalSessions, bestAccuracy };
  }, [sessions]);

  const handleSelectSong = useCallback(
    async (songId: string) => {
      setError(null);
      setLoadingId(songId);
      try {
        const result = await window.api.loadBuiltinSong(songId);
        if (result) {
          const parsed = parseMidiFile(result.fileName, result.data);
          loadSong(parsed);
          reset();
          await window.api.saveRecentFile({
            path: `builtin:${songId}`,
            name: result.fileName,
            timestamp: Date.now(),
          });
          refreshRecents();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("general.error");
        setError(msg);
        console.error("Failed to load built-in song:", e);
      } finally {
        setLoadingId(null);
      }
    },
    [loadSong, reset, refreshRecents, t],
  );

  /** Max recent files shown in the quick-access strip */
  const RECENT_DISPLAY_LIMIT = 5;
  const visibleRecents = recentFiles.slice(0, RECENT_DISPLAY_LIMIT);
  const continueRecent = recentFiles[0] ?? null;

  const handleSelectRecent = useCallback(
    async (file: RecentFile) => {
      setRecentRecovery(null);
      setLoadingRecentPath(file.path);
      try {
        let result;
        if (file.path.startsWith("builtin:")) {
          // Built-in song — extract the songId and load via library API
          const songId = file.path.slice("builtin:".length);
          result = await window.api.loadBuiltinSong(songId);
        } else {
          // User-imported file — load by absolute path
          result = await window.api.loadMidiPath(file.path);
        }

        if (!result) {
          setRecentRecovery(
            getRecentFileRecovery(file, { kind: "missing" }, t),
          );
          return;
        }
        let parsed;
        try {
          parsed = parseMidiFile(result.fileName, result.data);
        } catch (e) {
          setRecentRecovery(
            getRecentFileRecovery(
              file,
              { kind: "parse-failed", diagnostic: e },
              t,
            ),
          );
          console.error("Failed to parse recent file:", e);
          return;
        }
        loadSong(parsed);
        reset();
        await window.api.saveRecentFile({
          path: file.path,
          name: file.name,
          timestamp: Date.now(),
        });
        refreshRecents();
      } catch (e) {
        setRecentRecovery(
          getRecentFileRecovery(
            file,
            { kind: "read-failed", diagnostic: e },
            t,
          ),
        );
        console.error("Failed to load recent file:", e);
      } finally {
        setLoadingRecentPath(null);
      }
    },
    [loadSong, reset, refreshRecents, t],
  );

  const handleRemoveRecent = useCallback(
    async (filePath: string) => {
      await removeRecent(filePath);
      setRecentRecovery(null);
    },
    [removeRecent],
  );

  return (
    <div className="flex-1 min-h-0 app-shell overflow-y-auto overflow-x-hidden">
      <div className="mx-auto w-full max-w-6xl px-6 py-6 pb-24">
        <header className="surface-panel subtle-shadow sticky top-4 z-20 mb-5 p-4 sm:p-5 animate-page-enter">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="btn-surface-themed flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
                  aria-label={t("settings.shortcut.closeBack")}
                >
                  <ArrowLeft size={13} />
                </button>
              )}
              <img
                src={appIcon}
                alt=""
                width={42}
                height={42}
                className="rounded-xl subtle-shadow"
              />
              <div className="min-w-0">
                <span className="kicker-label">{t("app.subtitle")}</span>
                <h1
                  className="text-3xl font-display font-bold tracking-tight leading-none"
                  style={{ color: "var(--color-text)" }}
                >
                  Rexiano
                </h1>
                <p
                  className="text-sm mt-1"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {greeting}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={onOpenFile}
                className="btn-primary-themed flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer"
              >
                <Upload size={15} />
                {t("library.importMidi")}
              </button>
              <ThemePicker />
            </div>
          </div>

          {isProgressLoaded && sessions.length > 0 && (
            <div
              className="mt-4 grid gap-3 rounded-xl px-4 py-3 sm:grid-cols-3"
              style={{
                background:
                  "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
                border:
                  "1px solid color-mix(in srgb, var(--color-accent) 16%, var(--color-border))",
              }}
            >
              <StatBadge
                icon={<Music size={14} />}
                value={progressStats.uniqueSongs}
                label={
                  progressStats.uniqueSongs === 1
                    ? t("library.songPracticed")
                    : t("library.songsPracticed")
                }
              />
              <StatBadge
                icon={<Flame size={14} />}
                value={progressStats.totalSessions}
                label={
                  progressStats.totalSessions === 1
                    ? t("library.session")
                    : t("library.sessions")
                }
              />
              <StatBadge
                icon={<Trophy size={14} />}
                value={`${progressStats.bestAccuracy}%`}
                label={t("library.bestScore")}
              />
            </div>
          )}

          <div
            className="mt-4 rounded-xl px-4 py-3"
            style={{
              background:
                "color-mix(in srgb, var(--color-note2) 8%, var(--color-surface))",
              border:
                "1px solid color-mix(in srgb, var(--color-note2) 18%, var(--color-border))",
            }}
            data-testid="library-daily-goal"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className="flex items-center gap-2 text-xs font-body font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Target size={14} style={{ color: "var(--color-note2)" }} />
                {t("library.dailyGoal.label")}
              </span>
              <span
                className="text-xs font-mono tabular-nums"
                style={{ color: "var(--color-text)" }}
              >
                {t("library.dailyGoal.minutes", {
                  practiced: dailyGoalStatus.practicedMinutes,
                  target: dailyGoalStatus.targetMinutes,
                })}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full"
              style={{ background: "var(--color-surface-alt)" }}
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.round(dailyGoalStatus.completionRatio * 100)}%`,
                  background: "var(--color-note2)",
                }}
              />
            </div>
            <p
              className="mt-1.5 text-[11px] font-body"
              style={{ color: "var(--color-text-muted)" }}
            >
              {dailyGoalStatus.isComplete
                ? t("library.dailyGoal.complete")
                : t("library.dailyGoal.remaining", {
                    remaining: dailyGoalStatus.remainingMinutes,
                  })}
            </p>
          </div>
        </header>

        {practiceRecommendation && (
          <section className="surface-elevated mb-5 p-4 animate-page-enter">
            <button
              type="button"
              onClick={() => handleSelectSong(practiceRecommendation.song.id)}
              disabled={loadingId === practiceRecommendation.song.id}
              className="group flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left cursor-pointer transition-all duration-150 disabled:opacity-60 disabled:cursor-wait"
              style={{
                background:
                  "color-mix(in srgb, var(--color-note1) 10%, var(--color-surface))",
                border:
                  "1px solid color-mix(in srgb, var(--color-note1) 20%, var(--color-border))",
              }}
              data-testid="song-library-recommendation"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "var(--color-note1)",
                    color: "#fff",
                  }}
                >
                  {loadingId === practiceRecommendation.song.id ? (
                    <span
                      className="h-4 w-4 rounded-full border-2 animate-spin"
                      style={{
                        borderColor: "rgba(255,255,255,0.45)",
                        borderTopColor: "#fff",
                      }}
                    />
                  ) : (
                    <PlayCircle size={20} />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-xs font-body font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-note1)" }}
                  >
                    {t("library.recommendation.title")}
                  </span>
                  <span
                    className="block truncate text-base font-display font-bold"
                    style={{ color: "var(--color-text)" }}
                    data-testid="song-library-recommendation-title"
                  >
                    {practiceRecommendation.song.title}
                  </span>
                  <span
                    className="block text-xs font-body"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t(recommendationReasonKeys[practiceRecommendation.reason])}
                    {" · "}
                    {practiceRecommendation.bestAccuracy !== null
                      ? `${Math.round(practiceRecommendation.bestAccuracy)}%`
                      : t("library.neverPracticed")}
                  </span>
                </span>
              </span>
              <span
                className="hidden shrink-0 rounded-lg px-3 py-1.5 text-xs font-body font-semibold sm:inline-flex"
                style={{
                  color: "#fff",
                  background: "var(--color-note1)",
                }}
              >
                {t("library.recommendation.cta")}
              </span>
            </button>
          </section>
        )}

        {lessonProgression.groups.length > 0 && (
          <section
            className="surface-elevated mb-5 p-4 animate-page-enter"
            data-testid="lesson-progression-panel"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target size={14} style={{ color: "var(--color-note2)" }} />
                <span
                  className="text-xs font-body font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-note2)" }}
                >
                  {t("library.lessonPath.title")}
                </span>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-body font-medium"
                style={{
                  color: "var(--color-text-muted)",
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 76%, var(--color-surface))",
                  border: "1px solid var(--color-border)",
                }}
              >
                {t("library.lessonPath.free")}
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)]">
              {nextLesson && (
                <button
                  type="button"
                  onClick={() => handleSelectSong(nextLesson.song.id)}
                  disabled={loadingId === nextLesson.song.id}
                  className="group flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 text-left cursor-pointer transition-all disabled:cursor-wait disabled:opacity-60"
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-note2) 10%, var(--color-surface))",
                    border:
                      "1px solid color-mix(in srgb, var(--color-note2) 24%, var(--color-border))",
                  }}
                  data-testid="lesson-progression-next"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "var(--color-note2)",
                      color: "#fff",
                    }}
                  >
                    <PlayCircle size={18} />
                  </span>
                  <span className="min-w-0">
                    <span
                      className="block text-[10px] font-body font-semibold uppercase tracking-wide"
                      style={{ color: "var(--color-note2)" }}
                    >
                      {t("library.lessonPath.next")}
                    </span>
                    <span
                      className="block truncate text-sm font-display font-bold"
                      style={{ color: "var(--color-text)" }}
                    >
                      {nextLesson.song.title}
                    </span>
                    <span
                      className="block truncate text-xs font-body"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {t(lessonRecommendationReasonKeys[nextLesson.reason])}
                      {" · "}
                      {t("library.lessonPath.mastery", {
                        accuracy: lessonProgression.masteryAccuracy,
                      })}
                    </span>
                  </span>
                </button>
              )}

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {lessonProgression.groups.map((group) => {
                  const progressPercent =
                    group.totalSongCount > 0
                      ? Math.round(
                          (group.completedSongCount / group.totalSongCount) *
                            100,
                        )
                      : 0;

                  return (
                    <div
                      key={group.id}
                      className="rounded-xl px-3 py-2.5"
                      style={{
                        background:
                          "color-mix(in srgb, var(--color-surface) 84%, transparent)",
                        border: "1px solid var(--color-border)",
                      }}
                      data-testid={`lesson-group-${group.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="truncate text-xs font-body font-semibold"
                          style={{ color: "var(--color-text)" }}
                        >
                          {group.title}
                        </span>
                        <span
                          className="shrink-0 text-[10px] font-mono tabular-nums"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {t("library.lessonPath.completed", {
                            completed: group.completedSongCount,
                            total: group.totalSongCount,
                          })}
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full"
                        style={{
                          background:
                            "color-mix(in srgb, var(--color-border) 70%, transparent)",
                        }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${progressPercent}%`,
                            background: group.completed
                              ? "var(--color-success, #22c55e)"
                              : "var(--color-note2)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {continueRecent && (
          <section
            className="surface-elevated mb-5 p-4 animate-page-enter"
            data-testid="song-library-continue"
          >
            <button
              onClick={() => handleSelectRecent(continueRecent)}
              disabled={loadingRecentPath === continueRecent.path}
              className="group flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left cursor-pointer transition-all duration-150 disabled:opacity-60 disabled:cursor-wait"
              style={{
                background:
                  "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                border:
                  "1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))",
              }}
              title={continueRecent.path}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: "var(--color-accent)",
                    color: "#fff",
                  }}
                >
                  {loadingRecentPath === continueRecent.path ? (
                    <span
                      className="h-4 w-4 rounded-full border-2 animate-spin"
                      style={{
                        borderColor: "rgba(255,255,255,0.45)",
                        borderTopColor: "#fff",
                      }}
                    />
                  ) : (
                    <PlayCircle size={20} />
                  )}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-xs font-body font-semibold uppercase tracking-wide"
                    style={{ color: "var(--color-accent)" }}
                  >
                    {t("library.continuePractice")}
                  </span>
                  <span
                    className="block truncate text-base font-display font-bold"
                    style={{ color: "var(--color-text)" }}
                  >
                    {continueRecent.name}
                  </span>
                  <span
                    className="block text-xs font-body"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("library.continueHint")} ·{" "}
                    {formatRelativeTime(continueRecent.timestamp)}
                  </span>
                </span>
              </div>
            </button>

            {visibleRecents.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {visibleRecents.slice(1).map((file, idx) => (
                  <button
                    key={file.path}
                    onClick={() => handleSelectRecent(file)}
                    disabled={loadingRecentPath === file.path}
                    className="card-hover animate-page-enter group relative min-w-[170px] max-w-[260px] flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-xs font-body font-medium cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-wait"
                    style={{
                      background:
                        "color-mix(in srgb, var(--color-surface) 82%, transparent)",
                      color: "var(--color-text)",
                      border: "1px solid var(--color-border)",
                      animationDelay: `${idx * 40}ms`,
                    }}
                    title={file.path}
                  >
                    <span
                      className="w-full text-left leading-tight"
                      style={{
                        color: "var(--color-text)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {file.name}
                    </span>
                    <span
                      className="shrink-0 opacity-70 font-mono tabular-nums text-[11px]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {formatRelativeTime(file.timestamp)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {recentRecovery && (
              <div
                className="flex flex-wrap items-center gap-2 mt-2 text-xs font-body"
                style={{ color: "#dc2626" }}
                title={recentRecovery.guidance.diagnostic || undefined}
                data-testid="recent-file-recovery"
              >
                <AlertCircle size={12} />
                <span className="min-w-0">
                  <span className="font-semibold">
                    {recentRecovery.guidance.title}
                  </span>
                  <span className="ml-1">
                    {recentRecovery.guidance.guidance}
                  </span>
                </span>
                {recentRecovery.canRemove && (
                  <button
                    onClick={() =>
                      void handleRemoveRecent(recentRecovery.removePath)
                    }
                    className="btn-surface-themed rounded-md px-2 py-0.5 text-[10px] font-body cursor-pointer"
                    style={{ color: "var(--color-text)" }}
                    data-testid="recent-file-remove-stale"
                  >
                    {recentRecovery.actionLabel}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        <section className="surface-panel p-4 sm:p-5 animate-page-enter">
          <SongLibraryFilters />

          <div className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--color-border)" }}
                  >
                    <div className="skeleton h-10" />
                    <div className="p-4 space-y-3">
                      <div className="skeleton h-4 w-3/4 rounded" />
                      <div className="skeleton h-3 w-1/2 rounded" />
                      <div className="flex justify-between mt-3">
                        <div className="skeleton h-4 w-16 rounded-full" />
                        <div className="skeleton h-3 w-10 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedSongs.length === 0 ? (
              <div
                className="text-center py-16 px-4"
                style={{ color: "var(--color-text-muted)" }}
              >
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                  }}
                >
                  <Music
                    size={28}
                    style={{ color: "var(--color-accent)", opacity: 0.6 }}
                  />
                </div>
                {songs.length === 0 ? (
                  <>
                    <p
                      className="text-sm font-body font-medium mb-1"
                      style={{ color: "var(--color-text)" }}
                    >
                      {t("library.noSongsYet")}
                    </p>
                    <p className="text-xs font-body opacity-70">
                      {t("library.noSongsHint")}
                    </p>
                  </>
                ) : (
                  <>
                    <p
                      className="text-sm font-body font-medium mb-1"
                      style={{ color: "var(--color-text)" }}
                    >
                      {t("library.noMatchSearch")}
                    </p>
                    <p className="text-xs font-body opacity-70">
                      {t("library.noMatchHint")}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                {viewMode === "list" ? (
                  <div className="space-y-2" data-testid="song-library-list">
                    <div
                      className="mb-2 flex items-center justify-between gap-3"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <span className="text-xs font-body font-semibold uppercase tracking-wider">
                        {t("library.allSongs")}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums">
                        {sortedSongs.length}
                      </span>
                    </div>
                    {sortedSongs.map((song, i) => (
                      <SongListRow
                        key={song.id}
                        song={song}
                        activity={songActivity.get(song.id) ?? emptyActivity}
                        isLoading={loadingId === song.id}
                        onSelect={handleSelectSong}
                        onToggleFavorite={toggleFavoriteSong}
                        animationDelay={i * 24}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-7">
                    {categoryGroups.map((group, groupIdx) => (
                      <section
                        key={group.category}
                        className="surface-elevated p-3 sm:p-4 animate-page-enter"
                        style={{ animationDelay: `${groupIdx * 60}ms` }}
                      >
                        <div
                          className="flex items-center gap-2 mb-3"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          <span className="text-xs font-body font-semibold uppercase tracking-wider">
                            {group.label}
                          </span>
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "var(--color-surface-alt)",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            {group.songs.length}
                          </span>
                          <div
                            className="flex-1 h-px ml-1"
                            style={{ background: "var(--color-border)" }}
                          />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                          {group.songs.map((song, i) => (
                            <div
                              key={song.id}
                              className="relative animate-stagger-child"
                              style={{
                                animationDelay: `${(groupIdx * 4 + i) * 30}ms`,
                              }}
                            >
                              <SongCard
                                song={song}
                                onSelect={handleSelectSong}
                                colorIndex={groupIdx * 4 + i}
                              />
                              <FavoriteButton
                                song={song}
                                activity={
                                  songActivity.get(song.id) ?? emptyActivity
                                }
                                onToggleFavorite={toggleFavoriteSong}
                                className="absolute right-2 top-2"
                              />
                              {loadingId === song.id && (
                                <LoadingOverlay radiusClass="rounded-xl" />
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {error && (
          <p
            className="mt-4 text-sm font-body"
            style={{ color: "var(--color-accent)" }}
          >
            {error}
          </p>
        )}

        <button
          ref={deviceDrawerTriggerRef}
          onClick={() => setShowDeviceDrawer(true)}
          className="fixed right-5 bottom-5 z-30 btn-surface-themed rounded-full px-3 py-2 flex items-center gap-1.5 text-xs font-body cursor-pointer subtle-shadow"
          data-testid="library-device-drawer-trigger"
        >
          <PanelRightOpen size={14} />
          MIDI
        </button>

        {showDeviceDrawer && (
          <div className="app-overlay-backdrop" onClick={closeDeviceDrawer}>
            <aside
              ref={deviceDrawerRef}
              className="app-side-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="MIDI"
              tabIndex={-1}
              data-testid="library-midi-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="app-side-drawer-header">
                <span className="kicker-label">MIDI</span>
                <button
                  ref={deviceDrawerCloseRef}
                  onClick={closeDeviceDrawer}
                  className="btn-surface-themed w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
                  aria-label={t("settings.close")}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="app-side-drawer-body">
                <section className="app-side-section">
                  <DeviceSelector />
                </section>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function formatSongDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SongListRow({
  song,
  activity,
  isLoading,
  onSelect,
  onToggleFavorite,
  animationDelay,
}: {
  song: BuiltinSongMeta;
  activity: SongActivity;
  isLoading: boolean;
  onSelect: (songId: string) => void;
  onToggleFavorite: (songId: string) => void;
  animationDelay: number;
}): React.JSX.Element {
  const { t } = useTranslation();
  const gradeColor =
    song.grade !== undefined
      ? getGradeColor(song.grade)
      : "var(--color-border)";
  const category = song.category ?? "popular";
  const practicedLabel =
    activity.playCount > 0
      ? t("library.practicedTimes", { count: activity.playCount })
      : t("library.neverPracticed");

  return (
    <div
      className="relative flex items-stretch gap-2 rounded-lg animate-stagger-child"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 88%, transparent)",
        border: "1px solid var(--color-border)",
        animationDelay: `${animationDelay}ms`,
      }}
    >
      <button
        data-testid={`song-select-${song.id}`}
        onClick={() => onSelect(song.id)}
        disabled={isLoading}
        className="grid min-w-0 flex-1 grid-cols-1 gap-2 px-3 py-2.5 text-left cursor-pointer disabled:cursor-wait disabled:opacity-60 md:grid-cols-[minmax(0,1.5fr)_auto_auto_auto]"
      >
        <span className="min-w-0">
          <h3
            className="truncate text-sm font-body font-semibold"
            data-testid="song-list-row-title"
            style={{ color: "var(--color-text)" }}
          >
            {song.title}
          </h3>
          <span
            className="mt-0.5 block truncate text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {song.composer}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold"
            style={{
              color: gradeColor,
              background: `color-mix(in srgb, ${gradeColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${gradeColor} 30%, transparent)`,
            }}
          >
            {song.grade !== undefined ? gradeLabelShort[song.grade] : "--"}
          </span>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-body font-medium"
            style={{
              color: "var(--color-text-muted)",
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
            }}
          >
            {categoryLabels[category]}
          </span>
        </span>

        <span
          className="flex items-center gap-2 text-[11px] font-mono tabular-nums md:justify-end"
          style={{ color: "var(--color-text-muted)" }}
        >
          <span>
            {activity.bestAccuracy !== null
              ? `${Math.round(activity.bestAccuracy)}%`
              : "--"}
          </span>
          <span>{practicedLabel}</span>
        </span>

        <span
          className="text-[11px] font-mono tabular-nums md:text-right"
          style={{ color: "var(--color-text-muted)" }}
        >
          {formatSongDuration(song.durationSeconds)}
        </span>
      </button>

      <FavoriteButton
        song={song}
        activity={activity}
        onToggleFavorite={onToggleFavorite}
        className="mr-2 self-center"
      />

      {isLoading && <LoadingOverlay radiusClass="rounded-lg" />}
    </div>
  );
}

function FavoriteButton({
  song,
  activity,
  onToggleFavorite,
  className = "",
}: {
  song: BuiltinSongMeta;
  activity: SongActivity;
  onToggleFavorite: (songId: string) => void;
  className?: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const label = activity.isFavorite
    ? t("library.unfavorite")
    : t("library.favorite");

  return (
    <button
      type="button"
      data-testid="song-favorite-toggle"
      onClick={() => onToggleFavorite(song.id)}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer ${className}`}
      aria-label={`${label}: ${song.title}`}
      aria-pressed={activity.isFavorite}
      title={`${label}: ${song.title}`}
      style={{
        background: activity.isFavorite
          ? "color-mix(in srgb, var(--color-streak-gold) 18%, var(--color-surface))"
          : "color-mix(in srgb, var(--color-surface) 90%, transparent)",
        color: activity.isFavorite
          ? "var(--color-streak-gold)"
          : "var(--color-text-muted)",
        border: "1px solid var(--color-border)",
      }}
    >
      <Star size={15} fill={activity.isFavorite ? "currentColor" : "none"} />
    </button>
  );
}

function LoadingOverlay({
  radiusClass,
}: {
  radiusClass: string;
}): React.JSX.Element {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${radiusClass}`}
      style={{
        background: "color-mix(in srgb, var(--color-surface) 70%, transparent)",
      }}
    >
      <div
        className="w-5 h-5 border-2 rounded-full animate-spin"
        style={{
          borderColor: "var(--color-border)",
          borderTopColor: "var(--color-accent)",
        }}
      />
    </div>
  );
}

function StatBadge({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 75%, transparent)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span style={{ color: "var(--color-accent)" }}>{icon}</span>
      <div className="min-w-0">
        <span
          className="text-sm font-display font-bold leading-tight block"
          style={{ color: "var(--color-text)" }}
        >
          {value}
        </span>
        <span
          className="text-[10px] font-body leading-tight truncate block"
          style={{ color: "var(--color-text-muted)" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
