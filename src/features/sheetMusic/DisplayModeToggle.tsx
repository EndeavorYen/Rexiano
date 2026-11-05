/**
 * DisplayModeToggle — Segmented control for falling notes or split view.
 */

import { Piano, Layers } from "lucide-react";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { DisplayMode } from "./types";
import type { TranslationKey } from "@renderer/i18n/types";

const modes: {
  value: DisplayMode;
  labelKey: TranslationKey;
  Icon: typeof Piano;
}[] = [
  { value: "falling", labelKey: "sheetMusic.modeFalling", Icon: Piano },
  { value: "split", labelKey: "sheetMusic.modeSplit", Icon: Layers },
];

export function DisplayModeToggle({
  testIdPrefix = "display-mode",
}: {
  testIdPrefix?: string;
} = {}): React.JSX.Element {
  const { t } = useTranslation();
  const displayMode = usePracticeStore((s) => s.displayMode);
  const setDisplayMode = usePracticeStore((s) => s.setDisplayMode);

  return (
    <div className="segmented" style={{ gap: 4, padding: 3 }}>
      {modes.map(({ value, labelKey, Icon }) => {
        const isActive = displayMode === value;
        return (
          <button
            key={value}
            onClick={() => setDisplayMode(value)}
            className="flex items-center justify-center gap-1.5 px-3 text-sm"
            style={{ minHeight: 36 }}
            aria-pressed={isActive}
            aria-label={t(labelKey)}
            data-testid={`${testIdPrefix}-${value}`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{t(labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
