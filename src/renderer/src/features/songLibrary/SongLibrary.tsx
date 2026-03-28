import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import {
  Upload,
  Clock,
  AlertCircle,
  Search,
  ArrowLeft,
  PanelRightOpen,
  RefreshCw,
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
import { withTimeout } from "@renderer/engines/audio/recoveryUtils";
import { getTimeOfDay } from "@renderer/utils/greeting";
import appIcon from "../../../../../docs/figure/Rexiano_icon.png";
import type { RecentFile } from "../../../../shared/types";

/** IPC timeout in milliseconds — prevents indefinite hangs (R1-02) */
const IPC_TIMEOUT_MS = 10_000;

/** Auto-dismiss timer for inline error messages (R1-04) */
const ERROR_AUTO_DISMISS_MS = 5_000;

interface SongLibraryProps {
  onOpenFile: () => Promise<void>;
  onBack?: () => void;
}

export function SongLibrary({
  onOpenFile,
  onBack,
}: SongLibraryProps): React.JSX.Element {
  const { t, lang } = useTranslation();

  // R3-02 fix: removed useMemo — cheap computation, and stale greeting across
  // time-of-day boundaries was a UX issue for long sessions. Re-evaluates every render.
  // R1-03 fix: unified cutoff via shared getTimeOfDay() (previously < 17 here vs < 18 in MainMenu)
  const greeting = t(`library.greeting.${getTimeOfDay()}`);

  const songs = useSongLibraryStore((s) => s.songs);
  const isLoading = useSongLibraryStore((s) => s.isLoading);
  const fetchError = useSongLibraryStore((s) => s.fetchError);
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

  // R1-03: mountedRef guards async setState after unmount
  const mountedRef = useRef(true);
  // R1-01: synchronous interlock prevents double-click races
  const loadingRef = useRef(false);
  const recentErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // R1-04: auto-dismiss timer for builtin song error
  const builtinErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recentErrorTimer.current) clearTimeout(recentErrorTimer.current);
      if (builtinErrorTimer.current) clearTimeout(builtinErrorTimer.current);
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
      event.stopPropagation(); // R3-03 fix: match all other drawer Escape handlers
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

  // Derived: true when any song or recent file is currently loading
  const isGloballyLoading = loadingId !== null || loadingRecentPath !== null;

  /**
   * R2-02 fix: shared song-loading helper. Both handleSelectSong and handleSelectRecent
   * delegate here to eliminate the ~50-line duplication. Differences are parameterized.
   */
  const loadSongViaIpc = useCallback(
    async (opts: {
      ipcCall: () => Promise<{ fileName: string; data: number[] } | null>;
      recentEntry: { path: string; name?: string };
      setErr: (msg: string | null) => void;
      setLoading: (v: string | null) => void;
      loadingKey: string;
      timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
      label: string;
      /** Human-readable title to display instead of the raw filename */
      displayName?: string;
    }) => {
      if (loadingRef.current) return;
      loadingRef.current = true;

      if (mountedRef.current) {
        opts.setErr(null);
        opts.setLoading(opts.loadingKey);
      }
      if (opts.timerRef.current) {
        clearTimeout(opts.timerRef.current);
        opts.timerRef.current = null;
      }
      try {
        const result = await withTimeout(
          opts.ipcCall(),
          IPC_TIMEOUT_MS,
          opts.label,
        );
        if (!mountedRef.current) return;
        if (!result) {
          opts.setErr(t("general.error"));
          opts.timerRef.current = setTimeout(() => {
            if (mountedRef.current) opts.setErr(null);
          }, ERROR_AUTO_DISMISS_MS);
          return;
        }
        const parsed = loadFromMidiData(result.fileName, result.data);
        if (opts.displayName) parsed.displayName = opts.displayName;
        reset();
        void window.api?.saveRecentFile({
          path: opts.recentEntry.path,
          name: opts.displayName ?? opts.recentEntry.name ?? result.fileName,
          timestamp: Date.now(),
        });
        refreshRecents();
      } catch (e) {
        if (!mountedRef.current) return;
        const msg = e instanceof Error ? e.message : t("general.error");
        opts.setErr(msg);
        opts.timerRef.current = setTimeout(() => {
          if (mountedRef.current) opts.setErr(null);
        }, ERROR_AUTO_DISMISS_MS);
        console.error(`Failed to load song (${opts.label}):`, e);
      } finally {
        loadingRef.current = false;
        if (mountedRef.current) opts.setLoading(null);
      }
    },
    [loadFromMidiData, reset, refreshRecents, t],
  );

  const handleSelectSong = useCallback(
    (songId: string) => {
      if (!window.api?.loadBuiltinSong) return;
      const meta = useSongLibraryStore
        .getState()
        .songs.find((s) => s.id === songId);
      const displayName = meta
        ? lang === "zh-TW"
          ? (meta.titleZh ?? meta.title)
          : meta.title
        : undefined;
      void loadSongViaIpc({
        ipcCall: () => window.api!.loadBuiltinSong(songId),
        recentEntry: { path: `builtin:${songId}` },
        setErr: setError,
        setLoading: setLoadingId,
        loadingKey: songId,
        timerRef: builtinErrorTimer,
        label: "loadBuiltinSong",
        displayName,
      });
    },
    [loadSongViaIpc, lang],
  );

  const visibleRecents = recentFiles.slice(0, 5);

  const handleSelectRecent = useCallback(
    (file: RecentFile) => {
      if (!window.api) return;
      let displayName: string | undefined;
      if (file.path.startsWith("builtin:")) {
        const songId = file.path.slice("builtin:".length);
        const meta = useSongLibraryStore
          .getState()
          .songs.find((s) => s.id === songId);
        displayName = meta
          ? lang === "zh-TW"
            ? (meta.titleZh ?? meta.title)
            : meta.title
          : file.name;
      }
      void loadSongViaIpc({
        ipcCall: () =>
          file.path.startsWith("builtin:")
            ? window.api!.loadBuiltinSong(file.path.slice("builtin:".length))
            : window.api!.loadMidiPath(file.path),
        recentEntry: { path: file.path, name: file.name },
        setErr: setRecentError,
        setLoading: setLoadingRecentPath,
        loadingKey: file.path,
        timerRef: recentErrorTimer,
        label: file.path.startsWith("builtin:")
          ? "loadBuiltinSong"
          : "loadMidiPath",
        displayName,
      });
    },
    [loadSongViaIpc, lang],
  );

  return (
    <div
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
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
                  disabled={isGloballyLoading}
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
            ) : fetchError && songs.length === 0 ? (
              /* R1-05: fetchSongs failure shown with retry button */
              <div
                className="text-center py-16 px-4 animate-page-enter"
                style={{ color: "var(--color-text-muted)" }}
              >
                <div
                  className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-error) 10%, var(--color-surface))",
                  }}
                >
                  <AlertCircle
                    size={24}
                    style={{ color: "var(--color-error)", opacity: 0.7 }}
                  />
                </div>
                <p
                  className="text-base font-display font-semibold mb-1.5"
                  style={{ color: "var(--color-text)" }}
                >
                  {t("library.emptyTitle")}
                </p>
                <p
                  className="text-sm font-body mb-4"
                  style={{ color: "var(--color-error)" }}
                >
                  {fetchError}
                </p>
                <button
                  onClick={() => fetchSongs()}
                  className="btn-surface-themed inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer"
                >
                  <RefreshCw size={14} />
                  {t("general.retry")}
                </button>
              </div>
            ) : filteredSongs.length === 0 ? (
              <div
                className="text-center py-16 px-4 animate-page-enter"
                style={{ color: "var(--color-text-muted)" }}
              >
                {songs.length === 0 ? (
                  <>
                    {/* Animated piano keys illustration */}
                    <div
                      className="flex items-start justify-center gap-1 mb-5"
                      aria-hidden="true"
                    >
                      <div className="empty-piano-key" />
                      <div className="empty-piano-key" />
                      <div className="empty-piano-key" />
                    </div>
                    <h2
                      className="text-base font-display font-semibold mb-1.5"
                      style={{ color: "var(--color-text)" }}
                    >
                      {t("library.emptyTitle")}
                    </h2>
                    <p
                      className="text-sm font-body mb-5"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {t("library.emptyHint")}
                    </p>
                    {/* Animated arrow pointing down */}
                    <div className="flex justify-center" aria-hidden="true">
                      <div className="empty-arrow-down" />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Wobbling search icon */}
                    <div
                      className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center empty-search-wobble"
                      style={{
                        background:
                          "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
                      }}
                    >
                      <Search
                        size={24}
                        style={{ color: "var(--color-accent)", opacity: 0.55 }}
                      />
                    </div>
                    <p
                      className="text-base font-display font-semibold mb-1"
                      style={{ color: "var(--color-text)" }}
                    >
                      {t("library.noMatchTitle")}
                    </p>
                    <p
                      className="text-sm font-body"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {t("library.noMatchAction")}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-7">
                {/* R1-02 fix: error rendered ONCE above all groups, not per-group */}
                {error && (
                  <div
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-body"
                    style={{
                      color: "var(--color-error)",
                      background:
                        "color-mix(in srgb, var(--color-error) 8%, var(--color-surface))",
                      border:
                        "1px solid color-mix(in srgb, var(--color-error) 25%, transparent)",
                    }}
                  >
                    <AlertCircle size={12} className="shrink-0" />
                    {error}
                  </div>
                )}

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
                          {/* R1-06: pass disabled when any song is loading */}
                          <SongCard
                            song={song}
                            onSelect={handleSelectSong}
                            colorIndex={groupIdx * 4 + i}
                            disabled={isGloballyLoading}
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

        {/* R1-02 fix: error now renders once above the groups (handled inside the song grid section) */}

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
