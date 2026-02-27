import { useEffect, useMemo, useCallback, useState } from "react";
import { Upload, Clock, AlertCircle } from "lucide-react";
import { parseMidiFile } from "../../engines/midi/MidiFileParser";
import { useSongStore } from "../../stores/useSongStore";
import { usePlaybackStore } from "../../stores/usePlaybackStore";
import { useSongLibraryStore } from "../../stores/useSongLibraryStore";
import { useRecentFiles } from "../../hooks/useRecentFiles";
import { formatRelativeTime } from "../../utils/relativeTime";
import { SongCard } from "./SongCard";
import { SongLibraryFilters } from "./SongLibraryFilters";
import { ThemePicker } from "../settings/ThemePicker";
import { groupSongsByCategory } from "./songCardUtils";
import { DeviceSelector } from "../midiDevice/DeviceSelector";
import appIcon from "../../assets/icon.png";
import type { RecentFile } from "../../../../shared/types";

interface SongLibraryProps {
  onOpenFile: () => Promise<void>;
}

export function SongLibrary({
  onOpenFile,
}: SongLibraryProps): React.JSX.Element {
  const songs = useSongLibraryStore((s) => s.songs);
  const isLoading = useSongLibraryStore((s) => s.isLoading);
  const searchQuery = useSongLibraryStore((s) => s.searchQuery);
  const difficultyFilter = useSongLibraryStore((s) => s.difficultyFilter);
  const fetchSongs = useSongLibraryStore((s) => s.fetchSongs);

  const loadSong = useSongStore((s) => s.loadSong);
  const reset = usePlaybackStore((s) => s.reset);

  const { recentFiles, refresh: refreshRecents } = useRecentFiles();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [loadingRecentPath, setLoadingRecentPath] = useState<string | null>(
    null,
  );

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

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
        const msg = e instanceof Error ? e.message : "Failed to load song";
        setError(msg);
        console.error("Failed to load built-in song:", e);
      } finally {
        setLoadingId(null);
      }
    },
    [loadSong, reset, refreshRecents],
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
          setRecentError(`File not found: ${file.name}`);
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
        const msg = e instanceof Error ? e.message : "Failed to load file";
        setRecentError(msg);
        setTimeout(() => setRecentError(null), 3000);
        console.error("Failed to load recent file:", e);
      } finally {
        setLoadingRecentPath(null);
      }
    },
    [loadSong, reset, refreshRecents],
  );

  /**
   * Truncate a filename for display in the chip.
   * Keeps the extension visible so the user recognises it as a MIDI file.
   */
  const truncateName = (name: string, maxLen: number = 24): string => {
    if (name.length <= maxLen) return name;
    const ext = name.lastIndexOf(".") >= 0 ? name.slice(name.lastIndexOf(".")) : "";
    const stem = name.slice(0, name.length - ext.length);
    const available = maxLen - ext.length - 1; // 1 for the ellipsis char
    if (available <= 3) return name.slice(0, maxLen - 1) + "\u2026";
    return stem.slice(0, available) + "\u2026" + ext;
  };

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-8 overflow-y-auto relative">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <img
          src={appIcon}
          alt=""
          width={48}
          height={48}
          className="rounded-xl"
        />
        <h1
          className="text-5xl font-extrabold font-display"
          style={{ color: "var(--color-accent)" }}
        >
          Rexiano
        </h1>
      </div>
      <p
        className="text-base mb-8 font-body"
        style={{ color: "var(--color-text-muted)" }}
      >
        Pick a song to start practicing
      </p>

      {/* Recently Played */}
      {visibleRecents.length > 0 && (
        <div className="w-full max-w-2xl mb-5">
          <div
            className="flex items-center gap-1.5 mb-2.5"
            style={{ color: "var(--color-text-muted)" }}
          >
            <Clock size={13} />
            <span className="text-xs font-body font-medium uppercase tracking-wide">
              Recently Played
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleRecents.map((file) => (
              <button
                key={file.path}
                onClick={() => handleSelectRecent(file)}
                disabled={loadingRecentPath === file.path}
                className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body font-medium cursor-pointer transition-all duration-150 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-wait"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
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
                <span className="truncate max-w-[160px]">
                  {truncateName(file.name)}
                </span>
                <span
                  className="shrink-0 opacity-60"
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
        </div>
      )}

      {/* Filters */}
      <SongLibraryFilters />

      {/* Song grid — grouped by category */}
      <div className="w-full max-w-2xl mt-6">
        {isLoading ? (
          /* Skeleton loading cards */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
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
          /* Empty state */
          <div
            className="text-center py-16"
            style={{ color: "var(--color-text-muted)" }}
          >
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              fill="none"
              className="mx-auto mb-4 opacity-40"
            >
              <rect
                x="8"
                y="16"
                width="48"
                height="36"
                rx="4"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M24 36V28L36 32L24 36Z"
                fill="currentColor"
                opacity="0.3"
              />
              <path
                d="M24 36V28L36 32L24 36Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-sm font-body">
              {songs.length === 0
                ? "No built-in songs found"
                : "No songs match your filter"}
            </p>
            {songs.length === 0 && (
              <p className="text-xs mt-2 font-body opacity-70">
                Try importing a MIDI file to get started
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {categoryGroups.map((group, groupIdx) => (
              <section key={group.category}>
                {/* Category section header */}
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

                {/* Song cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {group.songs.map((song, i) => (
                    <div key={song.id} className="relative">
                      <SongCard
                        song={song}
                        onSelect={handleSelectSong}
                        colorIndex={groupIdx * 3 + i}
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

      {error && (
        <p
          className="mt-4 text-sm font-body"
          style={{ color: "var(--color-accent)" }}
        >
          {error}
        </p>
      )}

      {/* Secondary action: import custom file */}
      <div className="mt-8 mb-4">
        <button
          onClick={onOpenFile}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-body font-medium cursor-pointer btn-ghost-themed"
        >
          <Upload size={15} />
          Import your own MIDI file
        </button>
      </div>

      {/* Bottom bar: MIDI device + Theme picker */}
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto rounded-lg" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <DeviceSelector />
        </div>
        <div className="pointer-events-auto">
          <ThemePicker />
        </div>
      </div>
    </div>
  );
}
