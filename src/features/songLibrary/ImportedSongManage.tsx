import { forwardRef } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";

export interface ImportedSongManageProps {
  title: string;
  isEditing: boolean;
  /** Second step of removing: ask once, then delete */
  confirmingRemove: boolean;
  onEdit: () => void;
  onAskRemove: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
}

/**
 * Edit / remove for an imported song. Removing takes two taps: the row turns
 * into one question with "remove" and "not now"; Esc also backs out.
 */
export const ImportedSongManage = forwardRef<
  HTMLButtonElement,
  ImportedSongManageProps
>(function ImportedSongManage(
  {
    title,
    isEditing,
    confirmingRemove,
    onEdit,
    onAskRemove,
    onConfirmRemove,
    onCancelRemove,
  },
  editRef,
): React.JSX.Element {
  const { t } = useTranslation();

  if (confirmingRemove) {
    return (
      <div
        className="song-dialog-confirm"
        role="alertdialog"
        aria-label={t("songbook.remove.ask", { title })}
        data-testid="imported-song-remove-prompt"
      >
        <p>{t("songbook.remove.ask", { title })}</p>
        <div className="song-dialog-confirm-actions">
          <button
            type="button"
            className="btn-ghost-themed song-dialog-danger"
            onClick={onConfirmRemove}
            data-testid="imported-song-remove-confirm"
          >
            {t("songbook.remove.confirm")}
          </button>
          <button
            type="button"
            className="btn-ghost-themed"
            autoFocus
            onClick={onCancelRemove}
            data-testid="imported-song-remove-cancel"
          >
            {t("songbook.remove.cancel")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="song-dialog-manage">
      <button
        ref={editRef}
        type="button"
        className="btn-ghost-themed"
        aria-pressed={isEditing}
        onClick={onEdit}
        data-testid="imported-song-edit"
      >
        <Pencil size={16} aria-hidden="true" />
        {t("songbook.preview.edit")}
      </button>
      <button
        type="button"
        className="btn-ghost-themed"
        onClick={onAskRemove}
        data-testid="imported-song-remove"
      >
        <Trash2 size={16} aria-hidden="true" />
        {t("library.removeImported")}
      </button>
    </div>
  );
});
