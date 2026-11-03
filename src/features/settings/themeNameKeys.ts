import type { ThemeId } from "@renderer/themes/tokens";
import type { TranslationKey } from "@renderer/i18n/types";

export const themeNameKeys = {
  lavender: "settings.themeName.lavender",
  ocean: "settings.themeName.ocean",
  peach: "settings.themeName.peach",
  midnight: "settings.themeName.midnight",
} as const satisfies Record<ThemeId, TranslationKey>;
