import type { TranslationKey, TranslationMap } from "./types";

const PLACEHOLDER_RE = /\{([A-Za-z0-9_]+)\}/g;

export interface PlaceholderParityIssue {
  key: TranslationKey;
  basePlaceholders: string[];
  targetPlaceholders: string[];
}

export function extractInterpolationPlaceholders(text: string): string[] {
  const placeholders = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_RE)) {
    placeholders.add(match[1]);
  }
  return Array.from(placeholders).sort();
}

export function findPlaceholderParityIssues(
  base: TranslationMap,
  target: TranslationMap,
): PlaceholderParityIssue[] {
  const issues: PlaceholderParityIssue[] = [];

  for (const key of Object.keys(base) as TranslationKey[]) {
    const basePlaceholders = extractInterpolationPlaceholders(base[key]);
    const targetPlaceholders = extractInterpolationPlaceholders(target[key]);

    if (basePlaceholders.join("\u0000") !== targetPlaceholders.join("\u0000")) {
      issues.push({ key, basePlaceholders, targetPlaceholders });
    }
  }

  return issues;
}
