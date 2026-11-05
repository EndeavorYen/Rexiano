import { describe, expect, test } from "vitest";
import {
  CHANGELOG_VERSIONS,
  LATEST_VERSION,
  hasUnseenVersion,
  isNewVersion,
  localizedVersion,
} from "./changelog";
import pkg from "../../../package.json";

describe("in-app changelog", () => {
  test("newest version first, matching package.json", () => {
    expect(LATEST_VERSION).toBe(CHANGELOG_VERSIONS[0].version);
    expect(pkg.version.startsWith(`${LATEST_VERSION}.`)).toBe(true);
    const dates = CHANGELOG_VERSIONS.map((v) => v.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  test("every version is short, dated and has English text", () => {
    for (const v of CHANGELOG_VERSIONS) {
      expect(v.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.items.length).toBeGreaterThan(0);
      expect(v.items.length).toBeLessThanOrEqual(4);
      expect(v.en?.items.length).toBe(v.items.length);
    }
  });

  test("red dot shows until the newest version is opened", () => {
    expect(hasUnseenVersion(null)).toBe(true);
    expect(hasUnseenVersion(LATEST_VERSION)).toBe(false);
  });

  test("marks versions newer than the last one seen", () => {
    const oldest = CHANGELOG_VERSIONS.at(-1)!.version;
    expect(isNewVersion(0, null)).toBe(true);
    expect(isNewVersion(1, null)).toBe(false);
    expect(isNewVersion(0, oldest)).toBe(true);
    expect(isNewVersion(CHANGELOG_VERSIONS.length - 1, oldest)).toBe(false);
  });

  test("English readers get the English text", () => {
    const v = CHANGELOG_VERSIONS[0];
    expect(localizedVersion(v, "en").title).toBe(v.en!.title);
    expect(localizedVersion(v, "zh-TW").title).toBe(v.title);
  });
});
