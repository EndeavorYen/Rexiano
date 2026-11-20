import "./songbook.css";
import { useCallback, useId, useRef, type RefObject } from "react";
import { Pencil, Play, Star, Trash2, X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { StarRow } from "../progress/StarRow";
import { starsForAccuracy } from "../progress/stars";
import { SongCoverArt } from "./SongCoverArt";
import { classifySongLessonGroup } from "./lessonProgression";
import { IMPORTED_SONG_COLOR, lessonGroupColor } from "./lessonGroupColor";
import { songDisplayTitle } from "./songTitle";
import { formatShelfDuration } from "./songShelves";
import { ImportedSongMetadataEditor } from "./ImportedSongRow";
import type { SongSelectionPreviewModel } from "./songLibrarySelectors";
import type { PracticeSessionIntent } from "@renderer/features/practice/sessionIntent";
import type { ImportedSongMetadataDraft } from "./importedSongMetadata";

export interface SongSelectionPreviewPanelProps {
  preview: SongSelectionPreviewModel;
  isLoading: boolean;
  /** The cover that opened the dialog; focus goes back to it on close */
  returnFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onStartSession: (
    preview: SongSelectionPreviewModel,
    intent: PracticeSessionIntent,
  ) => void;
  onToggleFavorite: (songId: string) => void;
  /** Imported songs only */
  isEditing: boolean;
  metadataDraft: ImportedSongMetadataDraft | null;
  onEditImported: () => void;
  onRemoveImported: () => void;
  onUpdateDraft: (patch: Partial<ImportedSongMetadataDraft>) => void;
  onSaveMetadata: () => void;
  onCancelMetadata: () => void;
}

/**
 * What opens when a cover is tapped: the big cover, how well the child did
 * last time, and one yellow button. Nothing here is for grown-ups.
 */
export function SongSelectionPreviewPanel({
  preview,
  isLoading,
  returnFocusRef,
  onClose,
  onStartSession,
  onToggleFavorite,
  isEditing,
  metadataDraft,
  onEditImported,
  onRemoveImported,
  onUpdateDraft,
  onSaveMetadata,
  onCancelMetadata,
}: SongSelectionPreviewPanelProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  useDialogFocus({
    active: true,
    containerRef: sheetRef,
    initialFocusRef: primaryRef,
    returnFocusRef,
    onDismiss: onClose,
  });

  const handleScrimClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  const isBuiltin = preview.kind === "builtin";
  const title = isBuiltin
    ? songDisplayTitle(preview.song, lang)
    : { primary: preview.title, secondary: null };
  const color = isBuiltin
    ? lessonGroupColor(classifySongLessonGroup(preview.song))
    : IMPORTED_SONG_COLOR;
  const contour = isBuiltin ? preview.song.contour : undefined;
  const seed = isBuiltin ? preview.song.id : preview.importedSong.id;
  const stars = starsForAccuracy(preview.bestAccuracy);
  const played = preview.bestAccuracy !== null;
  const missing = !isBuiltin && preview.importedSong.missing;
  const level =
    preview.grade !== undefined
      ? t("songbook.level", { level: preview.grade })
      : null;
  const byline = [title.secondary, preview.composer]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="family-scrim" onClick={handleScrimClick}>
      <div
        ref={sheetRef}
        className="family-sheet song-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="song-selection-preview"
      >
        <button
          type="button"
          className="icon-btn song-dialog-close"
          aria-label={t("songbook.preview.close")}
          onClick={onClose}
          data-testid="song-selection-preview-close"
        >
          <X size={20} />
        </button>

        <div className="song-dialog-body">
          <div className="song-dialog-cover" style={{ background: color }}>
            <SongCoverArt
              contour={contour}
              seed={seed}
              color={color}
              className="art"
            />
          </div>

          <div className="song-dialog-info">
            <h2 id={titleId} data-testid="song-selection-preview-title">
              {title.primary}
            </h2>
            {byline && <p className="song-dialog-by">{byline}</p>}

            <div className="song-dialog-best">
              {played ? (
                <>
                  <StarRow
                    stars={stars}
                    size={30}
                    label={t("songbook.stars.label", { stars })}
                  />
                  <span className="song-dialog-percent">
                    {Math.round(preview.bestAccuracy ?? 0)}%
                  </span>
                </>
              ) : (
                <span className="song-dialog-never">
                  {t("songbook.preview.never")}
                </span>
              )}
            </div>

            <div className="song-dialog-pills">
              {preview.durationSeconds !== null && (
                <span className="pill">
                  {formatShelfDuration(preview.durationSeconds, t)}
                </span>
              )}
              {level && <span className="pill">{level}</span>}
            </div>

            {missing && (
              <p className="song-dialog-missing" role="alert">
                {t("library.importedMissing")}
              </p>
            )}

            <div className="song-dialog-actions">
              <button
                ref={primaryRef}
                type="button"
                className="btn-primary-themed song-dialog-primary"
                disabled={isLoading || missing}
                onClick={() => onStartSession(preview, "practice")}
                data-testid="song-selection-preview-practice"
              >
                {isLoading ? (
                  <span
                    className="cover-spinner is-inline"
                    aria-hidden="true"
                  />
                ) : (
                  <Play size={22} fill="currentColor" aria-hidden="true" />
                )}
                {played
                  ? t("songbook.preview.again")
                  : t("songbook.preview.play")}
              </button>

              {isBuiltin && (
                <button
                  type="button"
                  className="icon-btn"
                  data-testid="song-favorite-toggle"
                  aria-pressed={preview.isFavorite}
                  aria-label={`${
                    preview.isFavorite
                      ? t("library.unfavorite")
                      : t("library.favorite")
                  }: ${title.primary}`}
                  title={
                    preview.isFavorite
                      ? t("library.unfavorite")
                      : t("library.favorite")
                  }
                  onClick={() => onToggleFavorite(preview.song.id)}
                >
                  <Star
                    size={20}
                    fill={preview.isFavorite ? "currentColor" : "none"}
                  />
                </button>
              )}
            </div>

            {!isBuiltin && (
              <div className="song-dialog-manage">
                <button
                  type="button"
                  className="btn-ghost-themed"
                  aria-pressed={isEditing}
                  onClick={onEditImported}
                  data-testid="imported-song-edit"
                >
                  <Pencil size={16} aria-hidden="true" />
                  {t("songbook.preview.edit")}
                </button>
                <button
                  type="button"
                  className="btn-ghost-themed"
                  onClick={onRemoveImported}
                  data-testid="imported-song-remove"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  {t("library.removeImported")}
                </button>
              </div>
            )}
          </div>
        </div>

        {!isBuiltin && isEditing && metadataDraft && (
          <ImportedSongMetadataEditor
            draft={metadataDraft}
            onChange={onUpdateDraft}
            onSave={onSaveMetadata}
            onCancel={onCancelMetadata}
          />
        )}
      </div>
    </div>
  );
}
