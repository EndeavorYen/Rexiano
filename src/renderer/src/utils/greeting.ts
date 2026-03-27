/**
 * Shared time-of-day greeting logic.
 *
 * Provides a single source of truth for the afternoon/evening cutoff
 * so all views display consistent greetings.
 *
 * Cutoffs:
 *   - Morning:   00:00–11:59
 *   - Afternoon:  12:00–17:59
 *   - Evening:   18:00–23:59
 */
export type TimeOfDay = "morning" | "afternoon" | "evening";

/** Determine the time-of-day bucket for a given hour (0–23). */
export function getTimeOfDay(hour: number = new Date().getHours()): TimeOfDay {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
