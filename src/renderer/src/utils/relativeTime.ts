/**
 * Format a timestamp as a human-friendly relative time string.
 *
 * Designed for children — keeps language simple and avoids abbreviations
 * that might confuse young users.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param now - Current time in milliseconds (default: Date.now())
 * @returns A relative time string like "just now", "5m ago", "2h ago", "yesterday", "3d ago"
 */
export function formatRelativeTime(
  timestamp: number,
  now: number = Date.now(),
): string {
  const diffMs = now - timestamp;

  // Future or zero — treat as "just now"
  if (diffMs < 60_000) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diffMs / 86_400_000);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months === 1) return "1mo ago";
  if (months < 12) return `${months}mo ago`;

  return "long ago";
}
