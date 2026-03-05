/**
 * ─── Phase 6: Practice Mode Selector ────────────────────────
 *
 * Toggle button group for switching between Watch, Wait, Free,
 * and Step practice modes. Reads and writes mode via
 * usePracticeStore and displays mode descriptions on hover.
 */
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { PracticeMode } from "@shared/types";
import type { TranslationKey } from "@renderer/i18n/types";

const modes: {
  id: PracticeMode;
  labelKey: TranslationKey;
  descKey: TranslationKey;
}[] = [
  {
    id: "watch",
    labelKey: "practice.watch",
    descKey: "practice.mode.watchDesc",
  },
  {
    id: "wait",
    labelKey: "practice.wait",
    descKey: "practice.mode.waitDesc",
  },
  {
    id: "free",
    labelKey: "practice.free",
    descKey: "practice.mode.freeDesc",
  },
  {
    id: "step",
    labelKey: "practice.step",
    descKey: "practice.mode.stepDesc",
  },
];

export function PracticeModeSelector(): React.JSX.Element {
  const { t } = useTranslation();
  const currentMode = usePracticeStore((s) => s.mode);
  const setMode = usePracticeStore((s) => s.setMode);

  return (
    <div
      className="flex items-center gap-1 p-0.5 rounded-lg"
      style={{ background: "var(--color-surface-alt)" }}
      role="radiogroup"
      aria-label="Practice mode"
    >
      {modes.map(({ id, labelKey, descKey }) => {
        const isActive = currentMode === id;
        const label = t(labelKey);
        const desc = t(descKey);
        return (
          <button
            key={id}
            role="radio"
            aria-checked={isActive}
            onClick={() => setMode(id)}
            className="flex items-center justify-center rounded-md font-body font-semibold cursor-pointer"
            style={{
              background: isActive ? "var(--color-accent)" : "transparent",
              color: isActive ? "#fff" : "var(--color-text-muted)",
              boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
              transition: "all 0.2s ease",
              transform: isActive ? "scale(1)" : "scale(0.98)",
              minWidth: 54,
              minHeight: 36,
              padding: "6px 12px",
            }}
            title={desc}
            data-testid={`practice-mode-${id}`}
          >
            <span className="text-[12px] leading-tight">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
