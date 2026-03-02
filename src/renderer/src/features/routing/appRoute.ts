export type AppRoute = "menu" | "library" | "playback";

const FALLBACK_ROUTE: AppRoute = "menu";
const VALID_ROUTES = new Set<AppRoute>(["menu", "library", "playback"]);

/**
 * Parse window.location.hash to an app route.
 * Supported formats:
 * - "#/menu"
 * - "#/library"
 * - "#/playback"
 */
export function parseRouteHash(hash: string): AppRoute {
  const normalized = hash.trim().replace(/^#\/?/, "").toLowerCase();
  if (VALID_ROUTES.has(normalized as AppRoute)) {
    return normalized as AppRoute;
  }
  return FALLBACK_ROUTE;
}

/** Serialize an app route to hash form. */
export function routeToHash(route: AppRoute): string {
  return `#/${route}`;
}

/**
 * Routing rules:
 * 1) If a song is loaded, route is forced to playback.
 * 2) Without a song, playback route is invalid and falls back to menu.
 */
export function resolveRoute(route: AppRoute, hasSong: boolean): AppRoute {
  if (hasSong) return "playback";
  if (route === "playback") return "menu";
  return route;
}
