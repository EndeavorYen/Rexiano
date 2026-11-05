import { Upload } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { DailyGoalBanner } from "./DailyGoalBanner";
import { FamilyTopBar } from "../shell/FamilyTopBar";
import type { DailyGoalStatus } from "../practice/nextPracticeAction";

export interface SongLibraryHeaderProps {
  onBack?: () => void;
  onOpenFile: () => void;
  onOpenSettings?: () => void;
  greeting: string;
  dailyGoalStatus: DailyGoalStatus;
}

export function SongLibraryHeader({
  onBack,
  onOpenFile,
  onOpenSettings,
  greeting,
  dailyGoalStatus,
}: SongLibraryHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      {/* The bar sticks to the top of the scrolling library. */}
      <div
        className="sticky top-0 z-20 -mx-1 mb-3 px-1 pb-1"
        style={{ background: "var(--color-bg)" }}
      >
        <FamilyTopBar
          title={t("library.title")}
          onBack={onBack}
          onOpenSettings={onOpenSettings}
        >
          <button
            onClick={onOpenFile}
            data-testid="library-import-file"
            className="btn-primary-themed flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm cursor-pointer"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">{t("library.importMidi")}</span>
          </button>
        </FamilyTopBar>
      </div>
      <p
        className="mb-3 mt-0 px-1 font-display text-xl font-extrabold"
        data-testid="library-greeting"
      >
        {greeting}
      </p>
      <div className="mb-5">
        <DailyGoalBanner dailyGoalStatus={dailyGoalStatus} />
      </div>
    </>
  );
}
