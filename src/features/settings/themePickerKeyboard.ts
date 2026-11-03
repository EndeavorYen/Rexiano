import type { ThemeId } from "@renderer/themes/tokens";

export const themePickerThemeIds: readonly ThemeId[] = [
  "lavender",
  "ocean",
  "peach",
  "midnight",
];

const forwardKeys = new Set(["ArrowRight", "ArrowDown"]);
const backwardKeys = new Set(["ArrowLeft", "ArrowUp"]);

export function getThemePickerNavigationTarget(
  currentId: ThemeId,
  key: string,
): ThemeId | null {
  if (key === "Home") return themePickerThemeIds[0];
  if (key === "End") return themePickerThemeIds.at(-1) ?? null;

  const currentIndex = themePickerThemeIds.indexOf(currentId);
  if (currentIndex < 0) return null;
  if (forwardKeys.has(key)) {
    return themePickerThemeIds[(currentIndex + 1) % themePickerThemeIds.length];
  }
  if (backwardKeys.has(key)) {
    return themePickerThemeIds[
      (currentIndex - 1 + themePickerThemeIds.length) %
        themePickerThemeIds.length
    ];
  }
  return null;
}
