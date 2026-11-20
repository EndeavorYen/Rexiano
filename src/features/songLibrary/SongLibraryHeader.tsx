import "./songbook.css";
import { Upload } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { FamilyTopBar } from "../shell/FamilyTopBar";

export interface SongLibraryHeaderProps {
  onBack?: () => void;
  onOpenFile: () => void;
  onOpenSettings?: () => void;
}

export function SongLibraryHeader({
  onBack,
  onOpenFile,
  onOpenSettings,
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
      </FamilyTopBar>
    </div>
  );
}
