import type {
  TranslationMap,
  TranslationKey,
  InterpolationParams,
} from "./types";
import type { Language } from "@renderer/stores/useSettingsStore";
import { en } from "@renderer/locales/en";
import { zhTW } from "@renderer/locales/zh-TW";

/** Registry of all loaded locale maps */
const locales: Record<Language, TranslationMap> = {
  en: en,
  "zh-TW": zhTW,
};

/**
 * Core translation function.
 * Looks up a key in the specified locale, with optional interpolation.
 *
 * @param lang - The target language
 * @param key - A typed translation key
 * @param params - Optional interpolation values, e.g. { name: 'Rex' }
 * @returns The translated (and interpolated) string, or the key itself as fallback
 *
 * @example
 * translate('en', 'app.title') // "Rexiano"
 * translate('zh-TW', 'song.tracks') // "軌道"
 */
export function translate(
  lang: Language,
  key: TranslationKey,
  params?: InterpolationParams,
): string {
  const map = locales[lang] ?? locales["en"];
  let text = map[key] ?? locales["en"][key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }

  return text;
}

/**
 * Get all available languages.
 */
export function getAvailableLanguages(): { code: Language; label: string }[] {
  return [
    { code: "en", label: "English" },
    { code: "zh-TW", label: "繁體中文" },
  ];
}
