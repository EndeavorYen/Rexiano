import type { TranslationKey } from "@renderer/i18n/types";
import type { BrowseRoute } from "./useAppNavigation";

/** "Back to map" or "Back to shelf", by the screen the song was started from. */
export function backLabelKey(route: BrowseRoute): TranslationKey {
  return route === "menu" ? "nav.backToMap" : "nav.backToShelf";
}
