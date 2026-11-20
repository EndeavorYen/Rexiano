import "./songbook.css";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Heart, Play, X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { StarRow } from "../progress/StarRow";
import { MAX_STARS, starsForAccuracy } from "../progress/stars";
import { SongCoverArt } from "./SongCoverArt";
import { classifySongLessonGroup } from "./lessonProgression";
import { IMPORTED_SONG_COLOR, lessonGroupColor } from "./lessonGroupColor";
import { songByline, songDisplayTitle } from "./songTitle";
import { formatShelfDuration } from "./songShelves";
import { ImportedSongMetadataEditor } from "./ImportedSongRow";
import { ImportedSongManage } from "./ImportedSongManage";
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

  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Esc steps back one level: the remove question, then the rename form,
  // then the dialog itself.
  const dismissRef = useRef<() => void>(onClose);
  useLayoutEffect(() => {
    dismissRef.current = () => {
      if (confirmingRemove) setConfirmingRemove(false);
      else if (isEditing) onCancelMetadata();
      else onClose();
    };
  });
  // stable, so the dialog's focus trap is not rebuilt on every state change
  const handleDismiss = useCallback(() => dismissRef.current(), []);

  useDialogFocus({
    active: true,
    containerRef: sheetRef,
    initialFocusRef: primaryRef,
    returnFocusRef,
    onDismiss: handleDismiss,
  });

  // Closing the rename form (save or cancel) hands focus back to its button.
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !isEditing) editButtonRef.current?.focus();
    wasEditing.current = isEditing;
  }, [isEditing]);

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
  const byline = songByline(
    { secondary: title.secondary, composer: preview.composer },
    lang,
    t,
  );
  const favoriteLabel =
    isBuiltin && preview.isFavorite
      ? t("songbook.favorite.remove")
      : t("songbook.favorite.add");

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
              ) : null}
            </div>
            <p className="song-dialog-never" data-testid="song-preview-note">
              {!played
                ? t("songbook.preview.never")
                : stars >= MAX_STARS
                  ? t("songbook.preview.threeStars")
                  : t("songbook.preview.better")}
            </p>

            {preview.durationSeconds !== null && (
              <div className="song-dialog-pills">
                <span className="pill">
                  {formatShelfDuration(preview.durationSeconds, t)}
                </span>
              </div>
            )}

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
                  className="icon-btn song-dialog-heart"
                  data-testid="song-favorite-toggle"
                  aria-pressed={preview.isFavorite}
                  aria-label={favoriteLabel}
                  title={favoriteLabel}
                  onClick={() => onToggleFavorite(preview.song.id)}
                >
                  <Heart
                    size={22}
                    fill={preview.isFavorite ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>

            {!isBuiltin && (
              <ImportedSongManage
                ref={editButtonRef}
                title={title.primary}
                isEditing={isEditing}
                confirmingRemove={confirmingRemove}
                onEdit={onEditImported}
                onAskRemove={() => setConfirmingRemove(true)}
                onConfirmRemove={onRemoveImported}
                onCancelRemove={() => setConfirmingRemove(false)}
              />
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
