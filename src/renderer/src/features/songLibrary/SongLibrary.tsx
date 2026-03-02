import { useEffect, useMemo, useCallback, useState } from "react";
import {
  Upload,
  Clock,
  AlertCircle,
  Music,
  Trophy,
  Flame,
  ArrowLeft,
  PanelRightOpen,
  X,
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
import { groupSongsByCategory } from "./songCardUtils";
import { DeviceSelector } from "../midiDevice/DeviceSelector";
import { useTranslation } from "../../i18n/useTranslation";
import appIcon from "../../assets/icon.png";
import type { RecentFile } from "../../../../shared/types";

interface SongLibraryProps {
  onOpenFile: () => Promise<void>;
  onBack?: () => void;
}

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
  const fetchSongs = useSongLibraryStore((s) => s.fetchSongs);

  const loadSong = useSongStore((s) => s.loadSong);
  const reset = usePlaybackStore((s) => s.reset);

  const sessions = useProgressStore((s) => s.sessions);
  const isProgressLoaded = useProgressStore((s) => s.isLoaded);
  const loadSessions = useProgressStore((s) => s.loadSessions);

  const { recentFiles, refresh: refreshRecents } = useRecentFiles();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [loadingRecentPath, setLoadingRecentPath] = useState<string | null>(
    null,
  );
  const [showDeviceDrawer, setShowDeviceDrawer] = useState(false);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    if (!isProgressLoaded) {
      loadSessions();
    }
  }, [isProgressLoaded, loadSessions]);

  const filteredSongs = useMemo(() => {
    let result = songs;
    if (difficultyFilter !== "all") {
      result = result.filter((s) => s.difficulty === difficultyFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.composer.toLowerCase().includes(q),
      );
    }
    return result;
  }, [songs, difficultyFilter, searchQuery]);

  /** Songs grouped by category for section display */
  const categoryGroups = useMemo(
    () => groupSongsByCategory(filteredSongs),
    [filteredSongs],
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
          // Save to recent files with builtin: prefix
          void window.api.saveRecentFile({
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

  const handleSelectRecent = useCallback(
    async (file: RecentFile) => {
      setRecentError(null);
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
          setRecentError(t("general.error"));
          setTimeout(() => setRecentError(null), 3000);
          return;
        }
        const parsed = parseMidiFile(result.fileName, result.data);
        loadSong(parsed);
        reset();
        // Bump timestamp
        void window.api.saveRecentFile({
          path: file.path,
          name: file.name,
          timestamp: Date.now(),
        });
        refreshRecents();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("general.error");
        setRecentError(msg);
        setTimeout(() => setRecentError(null), 3000);
        console.error("Failed to load recent file:", e);
      } finally {
        setLoadingRecentPath(null);
      }
    },
    [loadSong, reset, refreshRecents, t],
  );

  /**
   * Truncate a filename for display in the chip.
   * Keeps the extension visible so the user recognises it as a MIDI file.
   */
  const truncateName = (name: string, maxLen: number = 24): string => {
    if (name.length <= maxLen) return name;
    const ext =
      name.lastIndexOf(".") >= 0 ? name.slice(name.lastIndexOf(".")) : "";
    const stem = name.slice(0, name.length - ext.length);
    const available = maxLen - ext.length - 1; // 1 for the ellipsis char
    if (available <= 3) return name.slice(0, maxLen - 1) + "\u2026";
    return stem.slice(0, available) + "\u2026" + ext;
  };

  return (
    <div className="flex-1 app-shell overflow-y-auto">
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
        </header>

        {visibleRecents.length > 0 && (
          <section className="surface-elevated mb-5 p-4 animate-page-enter">
            <div
              className="flex items-center gap-1.5 mb-2.5"
              style={{ color: "var(--color-text-muted)" }}
            >
              <Clock size={13} />
              <span className="text-xs font-body font-medium uppercase tracking-wide">
                {t("library.recentlyPlayed")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleRecents.map((file, idx) => (
                <button
                  key={file.path}
                  onClick={() => handleSelectRecent(file)}
                  disabled={loadingRecentPath === file.path}
                  className="card-hover animate-page-enter group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-body font-medium cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-wait"
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-surface) 82%, transparent)",
                    color: "var(--color-text)",
                    border: "1px solid var(--color-border)",
                    animationDelay: `${idx * 40}ms`,
                  }}
                  title={file.path}
                >
                  {loadingRecentPath === file.path ? (
                    <div
                      className="w-3 h-3 border-[1.5px] rounded-full animate-spin shrink-0"
                      style={{
                        borderColor: "var(--color-border)",
                        borderTopColor: "var(--color-accent)",
                      }}
                    />
                  ) : null}
                  <span className="truncate max-w-[180px]">
                    {truncateName(file.name)}
                  </span>
                  <span
                    className="shrink-0 opacity-70 font-mono tabular-nums"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {formatRelativeTime(file.timestamp)}
                  </span>
                </button>
              ))}
            </div>
            {recentError && (
              <div
                className="flex items-center gap-1.5 mt-2 text-xs font-body"
                style={{ color: "#dc2626" }}
              >
                <AlertCircle size={12} />
                {recentError}
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
            ) : filteredSongs.length === 0 ? (
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
                          {loadingId === song.id && (
                            <div
                              className="absolute inset-0 flex items-center justify-center rounded-xl"
                              style={{
                                background:
                                  "color-mix(in srgb, var(--color-surface) 70%, transparent)",
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
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
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
          onClick={() => setShowDeviceDrawer(true)}
          className="fixed right-5 bottom-5 z-30 btn-surface-themed rounded-full px-3 py-2 flex items-center gap-1.5 text-xs font-body cursor-pointer subtle-shadow"
          data-testid="library-device-drawer-trigger"
        >
          <PanelRightOpen size={14} />
          MIDI
        </button>

        {showDeviceDrawer && (
          <div
            className="app-overlay-backdrop"
            onClick={() => setShowDeviceDrawer(false)}
          >
            <aside
              className="app-side-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="app-side-drawer-header">
                <span className="kicker-label">MIDI</span>
                <button
                  onClick={() => setShowDeviceDrawer(false)}
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
