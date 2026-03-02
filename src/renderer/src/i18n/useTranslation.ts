import { useCallback } from "react";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { translate } from "./index";
import type { TranslationKey, InterpolationParams } from "./types";

/**
 * React hook for accessing translations in components.
 * Reads the current language from useSettingsStore and provides
 * a type-safe `t()` function.
 *
 * @example
 * function MyComponent() {
 *   const { t, lang } = useTranslation()
 *   return <h1>{t('app.title')}</h1>
 * }
 */
export function useTranslation(): {
  t: (key: TranslationKey, params?: InterpolationParams) => string;
  lang: string;
} {
  const language = useSettingsStore((s) => s.language);

  const t = useCallback(
    (key: TranslationKey, params?: InterpolationParams) =>
      translate(language, key, params),
    [language],
  );

  return { t, lang: language };
}
