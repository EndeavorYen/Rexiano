import { Pencil, AlertCircle, Check, X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { categoryLabelKeys } from "./songCardUtils";
import {
  importedCategoryOptions,
  type ImportedCategoryDraft,
  type ImportedSongMetadataDraft,
  type ImportedSongRecord,
} from "./importedSongMetadata";

function LoadingOverlay({
  radiusClass,
}: {
  radiusClass: string;
}): React.JSX.Element {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${radiusClass}`}
      style={{
        background: "color-mix(in srgb, var(--color-surface) 70%, transparent)",
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
  );
}

export interface ImportedSongRowProps {
  record: ImportedSongRecord;
  isLoading: boolean;
  isEditing: boolean;
  onSelect: (record: ImportedSongRecord, viaKeyboard: boolean) => void;
  onEdit: (record: ImportedSongRecord) => void;
  animationDelay: number;
}

export function ImportedSongRow({
  record,
  isLoading,
  isEditing,
  onSelect,
  onEdit,
  animationDelay,
}: ImportedSongRowProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className="relative flex items-stretch gap-2 rounded-lg animate-stagger-child"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 88%, transparent)",
        border: "1px solid var(--color-border)",
        animationDelay: `${animationDelay}ms`,
      }}
      title={record.sourcePath}
    >
      <button
        type="button"
        onClick={(event) => onSelect(record, event.detail === 0)}
        disabled={record.missing || isLoading}
        className="grid min-w-0 flex-1 grid-cols-1 gap-2 px-3 py-2.5 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 md:grid-cols-[minmax(0,1.5fr)_auto_auto]"
        data-testid={`imported-song-select-${record.id}`}
      >
        <span className="min-w-0">
          <span
            className="block truncate text-sm font-body font-semibold"
            style={{ color: "var(--color-text)" }}
            data-testid="imported-song-title"
          >
            {record.title}
          </span>
          <span
            className="mt-0.5 block truncate text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {record.composer ?? t("library.importedUnknownComposer")}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-body font-medium"
            style={{
              color: "var(--color-text-muted)",
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
            }}
          >
            {record.category ? t(categoryLabelKeys[record.category]) : "--"}
          </span>
        </span>

        <span
          className="flex items-center gap-2 text-[11px] font-body md:justify-end"
          style={{
            color: record.missing
              ? "var(--color-accent)"
              : "var(--color-text-muted)",
          }}
        >
          {record.missing ? (
            <>
              <AlertCircle size={12} />
              {t("library.importedMissingBadge")}
            </>
          ) : (
            t("library.importedAvailable")
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onEdit(record)}
        className="mr-2 self-center flex h-8 w-8 items-center justify-center rounded-full transition-colors cursor-pointer"
        aria-label={`${t("library.editImportedMetadata")}: ${record.title}`}
        aria-pressed={isEditing}
        title={`${t("library.editImportedMetadata")}: ${record.title}`}
        data-testid="imported-song-edit"
        style={{
          background: isEditing
            ? "color-mix(in srgb, var(--color-note3) 18%, var(--color-surface))"
            : "color-mix(in srgb, var(--color-surface) 90%, transparent)",
          color: isEditing ? "var(--color-note3)" : "var(--color-text-muted)",
          border: "1px solid var(--color-border)",
        }}
      >
        <Pencil size={14} />
      </button>

      {isLoading && <LoadingOverlay radiusClass="rounded-lg" />}
    </div>
  );
}

export interface ImportedSongMetadataEditorProps {
  draft: ImportedSongMetadataDraft;
  onChange: (patch: Partial<ImportedSongMetadataDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ImportedSongMetadataEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: ImportedSongMetadataEditorProps): React.JSX.Element {
  const { t } = useTranslation();
  const canSave = draft.title.trim().length > 0;

  return (
    <div
      className="grid gap-2 rounded-lg px-3 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_auto_auto]"
      style={{
        background: "color-mix(in srgb, var(--color-note3) 7%, transparent)",
        border:
          "1px solid color-mix(in srgb, var(--color-note3) 22%, var(--color-border))",
      }}
      data-testid="imported-song-metadata-editor"
    >
      <input
        value={draft.title}
        onChange={(event) => onChange({ title: event.target.value })}
        className="min-w-0 rounded-md px-2 py-1.5 text-xs font-body"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-label={t("library.importedMetadataTitle")}
        placeholder={t("library.importedMetadataTitle")}
        data-testid="imported-song-title-input"
      />
      <input
        value={draft.composer}
        onChange={(event) => onChange({ composer: event.target.value })}
        className="min-w-0 rounded-md px-2 py-1.5 text-xs font-body"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-label={t("library.importedMetadataComposer")}
        placeholder={t("library.importedMetadataComposer")}
        data-testid="imported-song-composer-input"
      />
      <input
        value={draft.tags}
        onChange={(event) => onChange({ tags: event.target.value })}
        className="min-w-0 rounded-md px-2 py-1.5 text-xs font-body"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-label={t("library.importedMetadataTags")}
        placeholder={t("library.importedMetadataTags")}
        data-testid="imported-song-tags-input"
      />
      <select
        value={draft.category}
        onChange={(event) =>
          onChange({ category: event.target.value as ImportedCategoryDraft })
        }
        className="rounded-md px-2 py-1.5 text-xs font-body"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        aria-label={t("library.importedMetadataCategory")}
        data-testid="imported-song-category-select"
      >
        <option value="">--</option>
        {importedCategoryOptions.map((category) => (
          <option key={category} value={category}>
            {t(categoryLabelKeys[category])}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1.5 justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="btn-primary-themed flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-body font-medium cursor-pointer disabled:opacity-50"
          aria-label={t("library.saveImportedMetadata")}
          title={t("library.saveImportedMetadata")}
          data-testid="imported-song-metadata-save"
        >
          <Check size={12} />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-surface-themed flex h-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-body font-medium cursor-pointer"
          aria-label={t("library.cancelImportedMetadata")}
          title={t("library.cancelImportedMetadata")}
          data-testid="imported-song-metadata-cancel"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
