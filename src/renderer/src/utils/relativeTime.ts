import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";

type Translate = (key: TranslationKey, params?: InterpolationParams) => string;

/**
 * Format a timestamp as a child-friendly relative time string.
 * Copy comes from i18n so a language switch updates the home/library recents.
 */
export function formatRelativeTime(
  timestamp: number,
  t: Translate,
  now: number = Date.now(),
): string {
  const diffMs = now - timestamp;

  if (diffMs < 60_000) return t("time.justNow");

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return t("time.minutesAgo", { count: minutes });

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return t("time.hoursAgo", { count: hours });

  const days = Math.floor(diffMs / 86_400_000);
  if (days === 1) return t("time.previousDay");
  if (days < 30) return t("time.daysAgo", { count: days });

  const months = Math.floor(days / 30);
  if (months < 12) return t("time.monthsAgo", { count: months });

  return t("time.longAgo");
}
