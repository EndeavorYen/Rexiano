/**
 * DisplayModeToggle — Segmented control for switching between
 * falling notes or sheet music display modes.
 */

import { Music, Piano } from "lucide-react";
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
];

export function DisplayModeToggle(): React.JSX.Element {
  const { t } = useTranslation();
  const displayMode = usePracticeStore((s) => s.displayMode);
  const setDisplayMode = usePracticeStore((s) => s.setDisplayMode);

  return (
    <div
      className="flex items-center gap-1 rounded-xl p-1"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 78%, transparent)",
        border: "1px solid var(--color-border)",
      }}
    >
      {modes.map(({ value, labelKey, Icon }) => {
        const isActive = displayMode === value;
        return (
          <button
            key={value}
            onClick={() => setDisplayMode(value)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-body cursor-pointer transition-colors"
            style={{
              background: isActive ? "var(--color-accent)" : "transparent",
              color: isActive ? "#fff" : "var(--color-text-muted)",
            }}
            aria-pressed={isActive}
            aria-label={t(labelKey)}
            data-testid={`display-mode-${value}`}
          >
            <Icon size={12} />
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
