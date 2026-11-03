import { Music } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { SongCard } from "./SongCard";
import { SongLibraryFilters } from "./SongLibraryFilters";
import { SongListRow, LoadingOverlay } from "./SongListRow";
import type { BuiltinSongMeta } from "@shared/types";
import type { SongActivity } from "./songLibrarySelectors";
import type { TranslationKey } from "@renderer/i18n/types";

export interface SongCatalogSectionProps {
  songs: BuiltinSongMeta[];
  sortedSongs: BuiltinSongMeta[];
  categoryGroups: {
    category: string;
    labelKey: TranslationKey;
    songs: BuiltinSongMeta[];
  }[];
  songActivity: Map<string, SongActivity>;
  emptyActivity: SongActivity;
  isLoading: boolean;
  viewMode: "list" | "cards";
  loadingId: string | null;
  selectedSongId: string | null;
  onSelectSong: (songId: string, viaKeyboard: boolean) => void;
  onToggleFavorite: (songId: string) => void;
}

export function SongCatalogSection({
  songs,
  sortedSongs,
  categoryGroups,
  songActivity,
  emptyActivity,
  isLoading,
  viewMode,
  loadingId,
  selectedSongId,
  onSelectSong,
  onToggleFavorite,
}: SongCatalogSectionProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
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
                    isSelected={selectedSongId === song.id}
                    onSelect={onSelectSong}
                    onToggleFavorite={onToggleFavorite}
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
                        {t(group.labelKey)}
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
                            onSelect={onSelectSong}
                            colorIndex={groupIdx * 4 + i}
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
  );
}
