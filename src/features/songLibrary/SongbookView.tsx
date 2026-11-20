import "./songbook.css";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { SongCoverCard, SongCoverSkeleton } from "./SongCoverCard";
import { SongShelfRow } from "./SongShelfRow";
import { lessonGroupColor, IMPORTED_SONG_COLOR } from "./lessonGroupColor";
import { songDisplayTitle } from "./songTitle";
import type { Songbook, SongbookItem, SongbookShelfId } from "./songShelves";
import type { LessonGroupId } from "./lessonProgression";
import type { ImportedSongRecord } from "./importedSongMetadata";
import { StarsSummaryCard } from "./StarsSummaryCard";
import type { StarsSummary } from "./starsSummary";

export interface SongbookViewProps {
  songbook: Songbook;
  isLoading: boolean;
  catalogueEmpty: boolean;
  loadingId: string | null;
  loadingImportedPath: string | null;
  /** song id → position in its unit (see coverVariantsByUnit) */
  coverVariants: ReadonlyMap<string, number>;
  starsSummary: StarsSummary;
  onPreviewSong: (songId: string, viaKeyboard: boolean) => void;
  onPreviewImported: (record: ImportedSongRecord, viaKeyboard: boolean) => void;
  onClearSearch: () => void;
}

function SongbookCover({
  item,
  loadingId,
  loadingImportedPath,
  coverVariants,
  onPreviewSong,
  onPreviewImported,
}: { item: SongbookItem } & Pick<
  SongbookViewProps,
  | "loadingId"
  | "loadingImportedPath"
  | "coverVariants"
  | "onPreviewSong"
  | "onPreviewImported"
>): React.JSX.Element {
  const { t, lang } = useTranslation();

  if (item.kind === "builtin") {
    const { song } = item;
    return (
      <SongCoverCard
        title={songDisplayTitle(song, lang).primary}
        durationSeconds={song.durationSeconds}
        stars={item.stars}
        color={lessonGroupColor(item.groupId)}
        contour={song.contour}
        seed={song.id}
        variant={coverVariants.get(song.id)}
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
  starsSummary,
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
        <div className="songbook-results-head">
          <h2 className="songbook-results-title">
            {t("songbook.results", { count: songbook.items.length })}
          </h2>
          <button
            type="button"
            className="btn-ghost-themed songbook-results-clear"
            onClick={onClearSearch}
            data-testid="song-library-clear-results"
          >
            {t("songbook.empty.clear")}
          </button>
        </div>
        <div className="songbook-grid">
          {songbook.items.map((item) => (
            <SongbookCover key={item.id} item={item} {...coverProps} />
          ))}
        </div>
      </section>
    );
  }

  const hasContinue = songbook.shelves[0]?.id === "continue";
  const showSummary = starsSummary.max > 0;

  return (
    <>
      {/* no "keep practising" shelf: the summary is a slim card of its own */}
      {!hasContinue && showSummary && (
        <StarsSummaryCard summary={starsSummary} layout="wide" standalone />
      )}
      {songbook.shelves.map((shelf) => (
        <SongShelfRow
          key={shelf.id}
          testId={`songbook-shelf-${shelf.id}`}
          title={t(shelf.titleKey)}
          description={
            shelf.descriptionKey ? t(shelf.descriptionKey) : undefined
          }
          featured={shelf.featured}
          dotColor={
            isUnitShelf(shelf.id) ? lessonGroupColor(shelf.id) : undefined
          }
          aside={
            shelf.id === "continue" && showSummary ? (
              <StarsSummaryCard summary={starsSummary} />
            ) : undefined
          }
          sub={
            shelf.id === "continue"
              ? t("songbook.shelf.continueHint")
              : shelf.completedCount === null
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

function isUnitShelf(id: SongbookShelfId): id is LessonGroupId {
  return id !== "continue" && id !== "favorites" && id !== "imported";
}
