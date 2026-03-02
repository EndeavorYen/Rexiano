import { describe, test, expect } from "vitest";
import { formatRelativeTime } from "./relativeTime";

describe("formatRelativeTime", () => {
  const NOW = 1_700_000_000_000; // fixed reference point

  test("returns 'just now' for timestamps less than 60s ago", () => {
    expect(formatRelativeTime(NOW - 0, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW - 59_999, NOW)).toBe("just now");
  });

  test("returns 'just now' for future timestamps", () => {
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe("just now");
  });

  test("returns minutes for 1–59 minutes ago", () => {
    expect(formatRelativeTime(NOW - 60_000, NOW)).toBe("1m ago");
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe("5m ago");
    expect(formatRelativeTime(NOW - 59 * 60_000, NOW)).toBe("59m ago");
  });

  test("returns hours for 1–23 hours ago", () => {
    expect(formatRelativeTime(NOW - 3_600_000, NOW)).toBe("1h ago");
    expect(formatRelativeTime(NOW - 2 * 3_600_000, NOW)).toBe("2h ago");
    expect(formatRelativeTime(NOW - 23 * 3_600_000, NOW)).toBe("23h ago");
  });

  test("returns 'yesterday' for exactly 1 day ago", () => {
    expect(formatRelativeTime(NOW - 86_400_000, NOW)).toBe("yesterday");
  });

  test("returns days for 2–29 days ago", () => {
    expect(formatRelativeTime(NOW - 2 * 86_400_000, NOW)).toBe("2d ago");
    expect(formatRelativeTime(NOW - 7 * 86_400_000, NOW)).toBe("7d ago");
    expect(formatRelativeTime(NOW - 29 * 86_400_000, NOW)).toBe("29d ago");
  });

  test("returns months for 30–364 days ago", () => {
    expect(formatRelativeTime(NOW - 30 * 86_400_000, NOW)).toBe("1mo ago");
    expect(formatRelativeTime(NOW - 60 * 86_400_000, NOW)).toBe("2mo ago");
    expect(formatRelativeTime(NOW - 11 * 30 * 86_400_000, NOW)).toBe(
      "11mo ago",
    );
  });

  test("returns 'long ago' for 12+ months", () => {
    expect(formatRelativeTime(NOW - 365 * 86_400_000, NOW)).toBe("long ago");
    expect(formatRelativeTime(NOW - 2 * 365 * 86_400_000, NOW)).toBe(
      "long ago",
    );
  });

  test("uses Date.now() as default when now is not provided", () => {
    // Just verify it doesn't throw and returns a string
    const result = formatRelativeTime(Date.now() - 5000);
    expect(typeof result).toBe("string");
    expect(result).toBe("just now");
  });
});
