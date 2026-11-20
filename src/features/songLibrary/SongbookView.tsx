import "./songbook.css";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { SongCoverCard, SongCoverSkeleton } from "./SongCoverCard";
import { SongShelfRow } from "./SongShelfRow";
import { lessonGroupColor, IMPORTED_SONG_COLOR } from "./lessonGroupColor";
import { songDisplayTitle } from "./songTitle";
import type { Songbook, SongbookItem } from "./songShelves";
import type { ImportedSongRecord } from "./importedSongMetadata";

export interface SongbookViewProps {
  songbook: Songbook;
  isLoading: boolean;
  catalogueEmpty: boolean;
  loadingId: string | null;
  loadingImportedPath: string | null;
  onPreviewSong: (songId: string, viaKeyboard: boolean) => void;
  onPreviewImported: (record: ImportedSongRecord, viaKeyboard: boolean) => void;
  onClearSearch: () => void;
}

function SongbookCover({
  item,
  loadingId,
  loadingImportedPath,
  onPreviewSong,
  onPreviewImported,
}: { item: SongbookItem } & Pick<
  SongbookViewProps,
  "loadingId" | "loadingImportedPath" | "onPreviewSong" | "onPreviewImported"
>): React.JSX.Element {
  const { t, lang } = useTranslation();

  if (item.kind === "builtin") {
    const { song } = item;
    return (
      <SongCoverCard
        title={songDisplayTitle(song, lang).primary}
        durationSeconds={song.durationSeconds}
        levelLabel={
          song.grade !== undefined
            ? t("songbook.level", { level: song.grade })
            : null
        }
        stars={item.stars}
        color={lessonGroupColor(item.groupId)}
        contour={song.contour}
        seed={song.id}
        testId={`song-select-${song.id}`}
        isLoading={loadingId === song.id}
        onSelect={(viaKeyboard) => onPreviewSong(song.id, viaKeyboard)}
      />
    );
  }

  const { record } = item;
  return (
    <SongCoverCard
      title={record.title}
      durationSeconds={null}
      levelLabel={
        record.grade !== undefined
          ? t("songbook.level", { level: record.grade })
          : null
      }
      noteOverride={
        record.missing
          ? t("library.importedMissingBadge")
          : (record.composer ?? t("songbook.shelf.imported"))
      }
      stars={item.stars}
      color={IMPORTED_SONG_COLOR}
      contour={undefined}
      seed={record.id}
      testId={`imported-song-select-${record.id}`}
      isLoading={loadingImportedPath === record.sourcePath}
      onSelect={(viaKeyboard) => onPreviewImported(record, viaKeyboard)}
    />
  );
}

/** The songbook body: shelves at rest, a cover grid while searching. */
export function SongbookView({
  songbook,
  isLoading,
  catalogueEmpty,
  onClearSearch,
  ...coverProps
}: SongbookViewProps): React.JSX.Element {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div
        className="shelf"
        role="status"
        aria-label={t("songbook.loading")}
        data-testid="song-library-loading"
      >
        <div className="row is-static">
          {Array.from({ length: 9 }, (_, i) => (
            <SongCoverSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (songbook.mode === "results") {
    if (songbook.items.length === 0) {
      return (
        <div className="songbook-empty" data-testid="song-library-empty">
          <p className="songbook-empty-title">
            {catalogueEmpty
              ? t("library.noSongsYet")
              : t("songbook.empty.title")}
          </p>
          <p className="songbook-empty-hint">
            {catalogueEmpty
              ? t("library.noSongsHint")
              : t("songbook.empty.hint")}
          </p>
          {!catalogueEmpty && (
            <button
              type="button"
              className="btn-ghost-themed songbook-empty-clear"
              onClick={onClearSearch}
              data-testid="song-library-clear-search"
            >
              {t("songbook.empty.clear")}
            </button>
          )}
        </div>
      );
    }
    return (
      <section
        className="songbook-results"
        aria-label={t("songbook.results", { count: songbook.items.length })}
        data-testid="song-library-results"
      >
        <h2 className="songbook-results-title">
          {t("songbook.results", { count: songbook.items.length })}
        </h2>
        <div className="songbook-grid">
          {songbook.items.map((item) => (
            <SongbookCover key={item.id} item={item} {...coverProps} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      {songbook.shelves.map((shelf) => (
        <SongShelfRow
          key={shelf.id}
          testId={`songbook-shelf-${shelf.id}`}
          title={t(shelf.titleKey)}
          sub={
            shelf.completedCount === null
              ? t("songbook.count", { count: shelf.totalCount })
              : t("songbook.progress", {
                  done: shelf.completedCount,
                  total: shelf.totalCount,
                })
          }
        >
          {shelf.items.map((item) => (
            <SongbookCover key={item.id} item={item} {...coverProps} />
          ))}
        </SongShelfRow>
      ))}
    </>
  );
}
