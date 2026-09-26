import { Upload, ArrowLeft } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { ThemePicker } from "../settings/ThemePicker";
import { DailyGoalBanner } from "./DailyGoalBanner";
import appIcon from "../../../../../docs/figure/Rexiano_icon.png";
import type { DailyGoalStatus } from "../practice/nextPracticeAction";

export interface SongLibraryHeaderProps {
  onBack?: () => void;
  onOpenFile: () => void;
  greeting: string;
  dailyGoalStatus: DailyGoalStatus;
}

export function SongLibraryHeader({
  onBack,
  onOpenFile,
  greeting,
  dailyGoalStatus,
}: SongLibraryHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <header className="surface-panel subtle-shadow mb-5 p-4 animate-page-enter sm:sticky sm:top-4 sm:z-20 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="btn-surface-themed flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
              aria-label={t("settings.shortcut.closeBack")}
            >
              <ArrowLeft size={13} />
            </button>
          )}
          <img
            src={appIcon}
            alt=""
            width={42}
            height={42}
            className="rounded-xl subtle-shadow"
          />
          <div className="min-w-0">
            <span className="kicker-label">{t("app.subtitle")}</span>
            <h1
              className="text-3xl font-display font-bold tracking-tight leading-none"
              style={{ color: "var(--color-text)" }}
            >
              Rexiano
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--color-text-muted)" }}
            >
              {greeting}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenFile}
            data-testid="library-import-file"
            className="btn-primary-themed flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium cursor-pointer"
          >
            <Upload size={15} />
            {t("library.importMidi")}
          </button>
          <ThemePicker />
        </div>
      </div>

      <DailyGoalBanner dailyGoalStatus={dailyGoalStatus} />
    </header>
  );
}
