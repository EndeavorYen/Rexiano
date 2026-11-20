import "./songbook.css";
import { Upload } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { FamilyTopBar } from "../shell/FamilyTopBar";

export interface SongLibraryHeaderProps {
  onBack?: () => void;
  onOpenFile: () => void;
  onOpenSettings?: () => void;
  /** Extra top-bar button after the import button (the piano) */
  trailing?: React.ReactNode;
}

export function SongLibraryHeader({
  onBack,
  onOpenFile,
  onOpenSettings,
  trailing,
}: SongLibraryHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="songbook-bar">
      <FamilyTopBar
        title={t("songbook.title")}
        onBack={onBack}
        onOpenSettings={onOpenSettings}
      >
        <span className="songbook-spacer" />
        <button
          type="button"
          onClick={onOpenFile}
          data-testid="library-import-file"
          className="btn-ghost-themed songbook-import"
        >
          <Upload size={18} aria-hidden="true" />
          <span>{t("library.importMidi")}</span>
        </button>
        {trailing}
      </FamilyTopBar>
    </div>
  );
}
