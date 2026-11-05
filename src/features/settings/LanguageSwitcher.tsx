import {
  useSettingsStore,
  type Language,
} from "@renderer/stores/useSettingsStore";
import { getAvailableLanguages } from "@renderer/i18n";
import { useTranslation } from "@renderer/i18n/useTranslation";

/** Language as a segmented control, matching the theme picker. */
export function LanguageSwitcher(): React.JSX.Element {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return (
    <div
      className="segmented"
      role="group"
      aria-label={t("settings.languageSwitcherAria")}
      data-testid="language-switcher"
    >
      {getAvailableLanguages().map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setLanguage(lang.code as Language)}
          aria-pressed={language === lang.code}
          data-testid={`lang-btn-${lang.code}`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
