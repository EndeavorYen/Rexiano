import { describe, test, expect } from "vitest";
import type { InterpolationParams, TranslationKey } from "@renderer/i18n/types";
import { formatRelativeTime } from "./relativeTime";

const t = (key: TranslationKey, params?: InterpolationParams): string => {
  if (key === "time.justNow") return "剛剛";
  if (key === "time.minutesAgo") return `${params?.count} 分鐘前`;
  if (key === "time.hoursAgo") return `${params?.count} 小時前`;
  if (key === "time.previousDay") return "昨天";
  if (key === "time.daysAgo") return `${params?.count} 天前`;
  if (key === "time.monthsAgo") return `${params?.count} 個月前`;
  if (key === "time.longAgo") return "很久以前";
  return key;
};

describe("formatRelativeTime", () => {
  const NOW = 1_700_000_000_000; // fixed reference point

  test("returns localized just-now copy for timestamps less than 60s ago", () => {
    expect(formatRelativeTime(NOW - 0, t, NOW)).toBe("剛剛");
    expect(formatRelativeTime(NOW - 30_000, t, NOW)).toBe("剛剛");
    expect(formatRelativeTime(NOW - 59_999, t, NOW)).toBe("剛剛");
  });

  test("returns just-now copy for future timestamps", () => {
    expect(formatRelativeTime(NOW + 60_000, t, NOW)).toBe("剛剛");
  });

  test("returns minutes for 1–59 minutes ago", () => {
    expect(formatRelativeTime(NOW - 60_000, t, NOW)).toBe("1 分鐘前");
    expect(formatRelativeTime(NOW - 5 * 60_000, t, NOW)).toBe("5 分鐘前");
    expect(formatRelativeTime(NOW - 59 * 60_000, t, NOW)).toBe("59 分鐘前");
  });

  test("returns hours for 1–23 hours ago", () => {
    expect(formatRelativeTime(NOW - 3_600_000, t, NOW)).toBe("1 小時前");
    expect(formatRelativeTime(NOW - 2 * 3_600_000, t, NOW)).toBe("2 小時前");
    expect(formatRelativeTime(NOW - 23 * 3_600_000, t, NOW)).toBe("23 小時前");
  });

  test("returns yesterday for exactly 1 day ago", () => {
    expect(formatRelativeTime(NOW - 86_400_000, t, NOW)).toBe("昨天");
  });

  test("returns days for 2–29 days ago", () => {
    expect(formatRelativeTime(NOW - 2 * 86_400_000, t, NOW)).toBe("2 天前");
    expect(formatRelativeTime(NOW - 7 * 86_400_000, t, NOW)).toBe("7 天前");
    expect(formatRelativeTime(NOW - 29 * 86_400_000, t, NOW)).toBe("29 天前");
  });

  test("returns months for 30–364 days ago", () => {
    expect(formatRelativeTime(NOW - 30 * 86_400_000, t, NOW)).toBe("1 個月前");
    expect(formatRelativeTime(NOW - 60 * 86_400_000, t, NOW)).toBe("2 個月前");
    expect(formatRelativeTime(NOW - 11 * 30 * 86_400_000, t, NOW)).toBe(
      "11 個月前",
    );
  });

  test("returns long-ago copy for 12+ months", () => {
    expect(formatRelativeTime(NOW - 365 * 86_400_000, t, NOW)).toBe("很久以前");
    expect(formatRelativeTime(NOW - 2 * 365 * 86_400_000, t, NOW)).toBe(
      "很久以前",
    );
  });

  test("uses Date.now() as default when now is not provided", () => {
    const result = formatRelativeTime(Date.now() - 5000, t);
    expect(typeof result).toBe("string");
    expect(result).toBe("剛剛");
  });
});
