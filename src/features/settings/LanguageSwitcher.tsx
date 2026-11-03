import {
  useSettingsStore,
  type Language,
} from "@renderer/stores/useSettingsStore";
import { getAvailableLanguages } from "@renderer/i18n";
import { useTranslation } from "@renderer/i18n/useTranslation";

interface LanguageSwitcherProps {
  compact?: boolean;
}

export function LanguageSwitcher({
  compact = false,
}: LanguageSwitcherProps): React.JSX.Element {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return (
    <div
      className={
        compact ? "inline-flex items-center gap-1" : "flex flex-col gap-2 mt-3"
      }
      role="group"
      aria-label={t("settings.languageSwitcherAria")}
      data-testid="language-switcher"
    >
      {getAvailableLanguages().map((lang) => {
        const selected = language === lang.code;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code as Language)}
            className={
              compact
                ? "px-2 py-1 rounded-full text-[11px] font-body cursor-pointer"
                : "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors text-left"
            }
            style={
              compact
                ? {
                    background: selected
                      ? "color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))"
                      : "transparent",
                    color: selected
                      ? "var(--color-accent-text)"
                      : "var(--color-text-muted)",
                    border: selected
                      ? "1px solid var(--color-accent)"
                      : "1px solid var(--color-border)",
                  }
                : {
                    background: selected
                      ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
                      : "var(--color-surface-alt)",
                    border: selected
                      ? "1.5px solid var(--color-accent)"
                      : "1.5px solid transparent",
                  }
            }
            aria-pressed={selected}
            data-testid={`lang-btn-${lang.code}`}
          >
            <span
              className={
                compact ? "font-medium" : "text-sm font-body font-medium"
              }
              style={{
                color: selected
                  ? "var(--color-accent-text)"
                  : "var(--color-text)",
              }}
            >
              {lang.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
