import type { PracticeMode } from "@shared/types";

export interface ModeOptionModel {
  mode: PracticeMode;
  titleKey: "modeSelect.watchTitle" | "modeSelect.waitTitle";
  descKey: "modeSelect.watchKidDesc" | "modeSelect.waitKidDesc";
  /** The one sun-yellow card: the way most children should start */
  isPrimary: boolean;
}

const MODE_OPTIONS: ModeOptionModel[] = [
  {
    mode: "watch",
    titleKey: "modeSelect.watchTitle",
    descKey: "modeSelect.watchKidDesc",
    isPrimary: false,
  },
  {
    mode: "wait",
    titleKey: "modeSelect.waitTitle",
    descKey: "modeSelect.waitKidDesc",
    isPrimary: true,
  },
];

/** Listen first, then play along. Play along is the primary card. */
export function getModeSelectionOptions(): ModeOptionModel[] {
  return MODE_OPTIONS.map((option) => ({ ...option }));
}
