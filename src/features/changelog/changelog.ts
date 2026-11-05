/**
 * What's new (src/data/changelog.json), like colormon and sudomon: an ⓘ
 * button with a little red dot while there is a version the player has not
 * opened yet. Keep each version to a short title and two to four things a
 * child or parent can see; CHANGELOG.md is generated from this file.
 */

import changelog from "../../data/changelog.json";
import type { Language } from "@renderer/stores/useSettingsStore";

export interface ChangelogVersion {
  version: string;
  date: string;
  title: string;
  items: string[];
  en?: { title: string; items: string[] };
}

export const CHANGELOG_VERSIONS: ChangelogVersion[] = (
  changelog as { versions: ChangelogVersion[] }
).versions;

export const LATEST_VERSION = CHANGELOG_VERSIONS[0]?.version ?? "";

const SEEN_KEY = "rexiano-seen-version";

export function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markLatestSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, LATEST_VERSION);
  } catch {
    // The red dot just comes back next time.
  }
}

export function hasUnseenVersion(
  seen: string | null = readSeenVersion(),
): boolean {
  return LATEST_VERSION !== "" && seen !== LATEST_VERSION;
}

/** Versions newer than the one last seen (only the newest on a first visit). */
export function isNewVersion(index: number, seen: string | null): boolean {
  const seenIndex = CHANGELOG_VERSIONS.findIndex((v) => v.version === seen);
  return seenIndex < 0 ? index === 0 : index < seenIndex;
}

export function localizedVersion(
  version: ChangelogVersion,
  lang: Language,
): { title: string; items: string[] } {
  if (lang === "en" && version.en) return version.en;
  return { title: version.title, items: version.items };
}
