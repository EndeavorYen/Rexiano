/**
 * DisplayModeToggle — Segmented control for switching between
 * falling notes, sheet music, or split (both) display modes.
 */

import { Music, Piano, Layers } from "lucide-react";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { DisplayMode } from "./types";
import type { TranslationKey } from "@renderer/i18n/types";

const modes: {
  value: DisplayMode;
  labelKey: TranslationKey;
  Icon: typeof Music;
}[] = [
  { value: "falling", labelKey: "sheetMusic.modeFalling", Icon: Piano },
  { value: "sheet", labelKey: "sheetMusic.modeSheet", Icon: Music },
  { value: "split", labelKey: "sheetMusic.modeSplit", Icon: Layers },
];

export function DisplayModeToggle(): React.JSX.Element {
  const { t } = useTranslation();
  const displayMode = usePracticeStore((s) => s.displayMode);
  const setDisplayMode = usePracticeStore((s) => s.setDisplayMode);

  return (
    <div className="flex items-center gap-1">
      {modes.map(({ value, labelKey, Icon }) => {
        const isActive = displayMode === value;
        return (
          <button
            key={value}
            onClick={() => setDisplayMode(value)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-body cursor-pointer"
            style={{
              background: isActive
                ? "var(--color-accent)"
                : "var(--color-surface-alt)",
              color: isActive ? "#fff" : "var(--color-text-muted)",
              transition: "all 0.15s ease",
            }}
            aria-pressed={isActive}
            aria-label={t(labelKey)}
          >
            <Icon size={12} />
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
