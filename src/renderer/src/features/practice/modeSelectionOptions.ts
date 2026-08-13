import type { PracticeMode } from "@shared/types";

export interface ModeOptionModel {
  mode: PracticeMode;
  titleKey: "practice.watch" | "practice.wait" | "practice.free";
  descKey:
    | "modeSelect.watchDesc"
    | "modeSelect.waitDesc"
    | "modeSelect.freeDesc";
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
  {
    mode: "free",
    titleKey: "practice.free",
    descKey: "modeSelect.freeDesc",
  },
];

export function getModeSelectionOptions(
  defaultMode: PracticeMode,
): ModeOptionModel[] {
  return MODE_OPTIONS.map((option) => ({
    ...option,
    isDefault: option.mode === defaultMode,
  }));
}
