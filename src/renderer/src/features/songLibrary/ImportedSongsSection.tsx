import { FolderOpen } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { ImportedSongRow, ImportedSongMetadataEditor } from "./ImportedSongRow";
import type {
  ImportedSongRecord,
  ImportedSongMetadataDraft,
} from "./importedSongMetadata";

export interface ImportedSongsSectionProps {
  songs: ImportedSongRecord[];
  loadingImportedPath: string | null;
  editingImportedSongId: string | null;
  importedMetadataDraft: ImportedSongMetadataDraft | null;
  onSelectSong: (record: ImportedSongRecord, viaKeyboard: boolean) => void;
  onEditSong: (record: ImportedSongRecord) => void;
  onUpdateDraft: (patch: Partial<ImportedSongMetadataDraft>) => void;
  onSaveMetadata: () => void;
  onCancelMetadata: () => void;
}

export function ImportedSongsSection({
  songs,
  loadingImportedPath,
  editingImportedSongId,
  importedMetadataDraft,
  onSelectSong,
  onEditSong,
  onUpdateDraft,
  onSaveMetadata,
  onCancelMetadata,
}: ImportedSongsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (songs.length === 0) return null;

  return (
    <section
      className="surface-elevated mb-5 p-4 animate-page-enter"
      data-testid="imported-song-library"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} style={{ color: "var(--color-note3)" }} />
          <span
            className="text-xs font-body font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-note3)" }}
          >
            {t("library.importedSongs")}
          </span>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-body font-medium"
          style={{
            color: "var(--color-text-muted)",
            background:
              "color-mix(in srgb, var(--color-surface-alt) 76%, var(--color-surface))",
            border: "1px solid var(--color-border)",
          }}
        >
          {t("library.importedSongs")}
        </span>
      </div>
      <div className="grid gap-2">
        {songs.map((record, index) => (
          <div key={record.id} className="grid gap-2">
            <ImportedSongRow
              record={record}
              isLoading={loadingImportedPath === record.sourcePath}
              isEditing={editingImportedSongId === record.id}
              onSelect={onSelectSong}
              onEdit={onEditSong}
              animationDelay={index * 24}
            />
            {editingImportedSongId === record.id && importedMetadataDraft && (
              <ImportedSongMetadataEditor
                draft={importedMetadataDraft}
                onChange={onUpdateDraft}
                onSave={onSaveMetadata}
                onCancel={onCancelMetadata}
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
