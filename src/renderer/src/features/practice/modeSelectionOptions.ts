import type { PracticeMode } from "@shared/types";

export interface ModeOptionModel {
  mode: Exclude<PracticeMode, "free">;
  titleKey: "practice.watch" | "practice.wait";
  descKey: "modeSelect.watchDesc" | "modeSelect.waitDesc";
  isDefault: boolean;
}

const MODE_OPTIONS: Array<Omit<ModeOptionModel, "isDefault">> = [
  {
    mode: "watch",
    titleKey: "practice.watch",
    descKey: "modeSelect.watchDesc",
  },
  {
    mode: "wait",
    titleKey: "practice.wait",
    descKey: "modeSelect.waitDesc",
  },
];

export function getModeSelectionOptions(
  defaultMode: PracticeMode,
): ModeOptionModel[] {
  const liveDefault = defaultMode === "wait" ? "wait" : "watch";
  return MODE_OPTIONS.map((option) => ({
    ...option,
    isDefault: option.mode === liveDefault,
  }));
}
