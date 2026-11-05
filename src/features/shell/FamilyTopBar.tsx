import { ArrowLeft, Settings } from "lucide-react";
import appIcon from "../../../docs/figure/Rexiano_icon.png";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { ChangelogButton } from "../changelog/ChangelogButton";

export interface FamilyTopBarProps {
  title?: string;
  onBack?: () => void;
  onOpenSettings?: () => void;
  /** Extra buttons placed before ⓘ and the gear. */
  children?: React.ReactNode;
  settingsTestId?: string;
}

/**
 * The top bar every family game shares: back, logo, title, then square icon
 * buttons on the right (what's new, settings).
 */
export function FamilyTopBar({
  title = "Rexiano",
  onBack,
  onOpenSettings,
  children,
  settingsTestId = "top-bar-settings",
}: FamilyTopBarProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <header className="family-bar" data-testid="family-top-bar">
      {onBack && (
        <button
          className="icon-btn"
          onClick={onBack}
          aria-label={t("settings.shortcut.closeBack")}
          title={t("settings.shortcut.closeBack")}
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <img className="logo" src={appIcon} alt="" aria-hidden="true" />
      <h1>{title}</h1>
      {children}
      <ChangelogButton />
      {onOpenSettings && (
        <button
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label={t("app.openSettings")}
          title={t("app.openSettings")}
          data-testid={settingsTestId}
        >
          <Settings size={20} />
        </button>
      )}
    </header>
  );
}
