import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { translate } from "./index";
import { I18nContext } from "./context";
import type { TranslationKey, InterpolationParams } from "./types";

/**
 * Optional context provider for i18n.
 * Wraps children with the current language from useSettingsStore.
 * Most components should use the `useTranslation` hook directly,
 * but this provider enables context-based access for deeply nested
 * components that need it.
 */
export function I18nProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const language = useSettingsStore((s) => s.language);

  const t = (key: TranslationKey, params?: InterpolationParams): string =>
    translate(language, key, params);

  return (
    <I18nContext.Provider value={{ language, t }}>
      {children}
    </I18nContext.Provider>
  );
}
