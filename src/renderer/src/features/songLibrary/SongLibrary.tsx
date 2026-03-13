import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import {
  Upload,
  Clock,
  AlertCircle,
  Music,
  ArrowLeft,
  PanelRightOpen,
  X,
} from "lucide-react";
import { useSongStore } from "../../stores/useSongStore";
import { usePlaybackStore } from "../../stores/usePlaybackStore";
import { useSongLibraryStore } from "../../stores/useSongLibraryStore";
import { useRecentFiles } from "../../hooks/useRecentFiles";
import { formatRelativeTime } from "../../utils/relativeTime";
import { SongCard } from "./SongCard";
import { SongLibraryFilters } from "./SongLibraryFilters";
import { ThemePicker } from "../settings/ThemePicker";
import { groupSongsByCategory, categoryI18nKeys } from "./songCardUtils";
import type { TranslationKey } from "../../i18n/types";
import { DeviceSelector } from "../midiDevice/DeviceSelector";
import { useTranslation } from "../../i18n/useTranslation";
import appIcon from "../../../../../docs/figure/Rexiano_icon.png";
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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t("library.greeting.morning");
    if (hour < 17) return t("library.greeting.afternoon");
    return t("library.greeting.evening");
  }, [t]);

  const songs = useSongLibraryStore((s) => s.songs);
  const isLoading = useSongLibraryStore((s) => s.isLoading);
  const searchQuery = useSongLibraryStore((s) => s.searchQuery);
  const gradeFilter = useSongLibraryStore((s) => s.gradeFilter);
  const fetchSongs = useSongLibraryStore((s) => s.fetchSongs);

  const loadFromMidiData = useSongStore((s) => s.loadFromMidiData);
  const reset = usePlaybackStore((s) => s.reset);
  const { recentFiles, refresh: refreshRecents } = useRecentFiles();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [loadingRecentPath, setLoadingRecentPath] = useState<string | null>(
    null,
  );
  const [showDeviceDrawer, setShowDeviceDrawer] = useState(false);
  const recentErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (recentErrorTimer.current) clearTimeout(recentErrorTimer.current);
    };
  }, []);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  useEffect(() => {
    if (!showDeviceDrawer) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setShowDeviceDrawer(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [showDeviceDrawer]);

  const filteredSongs = useMemo(() => {
    let result = songs;
    if (gradeFilter !== "all") {
      result = result.filter((s) => s.grade === gradeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.composer.toLowerCase().includes(q) ||
          (s.titleZh && s.titleZh.includes(q)) ||
          (s.composerZh && s.composerZh.includes(q)),
      );
    }
    return result;
  }, [songs, gradeFilter, searchQuery]);

  const categoryGroups = useMemo(
    () => groupSongsByCategory(filteredSongs),
    [filteredSongs],
  );

  const handleSelectSong = useCallback(
    async (songId: string) => {
      if (!window.api?.loadBuiltinSong) return;
      if (loadingId !== null || loadingRecentPath !== null) return;
      setError(null);
      setLoadingId(songId);
      try {
        const result = await window.api.loadBuiltinSong(songId);
        if (result) {
          loadFromMidiData(result.fileName, result.data);
          reset();
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
    [loadFromMidiData, reset, refreshRecents, t, loadingId, loadingRecentPath],
  );

  const visibleRecents = recentFiles.slice(0, 5);

  const handleSelectRecent = useCallback(
    async (file: RecentFile) => {
      if (!window.api) return;
      if (loadingId !== null || loadingRecentPath !== null) return;
      setRecentError(null);
      setLoadingRecentPath(file.path);
      try {
        const result = file.path.startsWith("builtin:")
          ? await window.api.loadBuiltinSong(file.path.slice("builtin:".length))
          : await window.api.loadMidiPath(file.path);

        if (!result) {
          setRecentError(t("general.error"));
          if (recentErrorTimer.current) clearTimeout(recentErrorTimer.current);
          recentErrorTimer.current = setTimeout(
            () => setRecentError(null),
            3000,
          );
          return;
        }

        loadFromMidiData(result.fileName, result.data);
        reset();
        void window.api.saveRecentFile({
          path: file.path,
          name: file.name,
          timestamp: Date.now(),
        });
        refreshRecents();
      } catch (e) {
        const msg = e instanceof Error ? e.message : t("general.error");
        setRecentError(msg);
        if (recentErrorTimer.current) clearTimeout(recentErrorTimer.current);
        recentErrorTimer.current = setTimeout(() => setRecentError(null), 3000);
        console.error("Failed to load recent file:", e);
      } finally {
        setLoadingRecentPath(null);
      }
    },
    [loadFromMidiData, reset, refreshRecents, t, loadingId, loadingRecentPath],
  );

  return (
    <div
      className="flex-1 min-h-0 app-shell overflow-y-auto overflow-x-hidden"
      data-testid="song-library-view"
    >
      <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6 pb-24">
        <header
          className="surface-panel subtle-shadow sticky top-4 z-20 mb-5 p-4 sm:p-5 animate-page-enter"
          data-testid="song-library-header"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="btn-surface-themed flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
                  aria-label={t("song.backToLibrary")}
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
                  data-testid="song-library-greeting"
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
                  disabled={loadingRecentPath !== null || loadingId !== null}
                  className="card-hover animate-page-enter group relative min-w-[190px] max-w-[280px] flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-xs font-body font-medium cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-wait"
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
                      className="w-3 h-3 border-[1.5px] rounded-full animate-spin shrink-0 absolute top-2.5 right-2.5"
                      style={{
                        borderColor: "var(--color-border)",
                        borderTopColor: "var(--color-accent)",
                      }}
                    />
                  ) : null}
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
            {recentError && (
              <div
                className="flex items-center gap-1.5 mt-2 text-xs font-body"
                style={{ color: "var(--color-error)" }}
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
                      <span className="text-sm font-body font-semibold uppercase tracking-wider">
                        {t(categoryI18nKeys[group.category] as TranslationKey)}
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
            style={{ color: "var(--color-error)" }}
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
            data-testid="library-midi-drawer-backdrop"
          >
            <aside
              className="app-side-drawer"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="MIDI"
              data-testid="library-midi-drawer"
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
