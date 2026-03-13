/**
 * ─── Phase 6: Practice Toolbar ──────────────────────────────
 *
 * Composite UI component that groups all practice controls
 * (mode selector, speed slider, A-B loop)
 * into a single toolbar embedded below the TransportBar.
 */
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { PracticeModeSelector } from "./PracticeModeSelector";
import { SpeedSlider } from "./SpeedSlider";
import { ABLoopSelector } from "./ABLoopSelector";

interface PracticeToolbarProps {
  compact?: boolean;
}

export function PracticeToolbar({
  compact = false,
}: PracticeToolbarProps): React.JSX.Element {
  const { t } = useTranslation();
  const kidMode = useSettingsStore((s) => s.kidMode);
  const [showAdvanced, setShowAdvanced] = useState(() => !compact);

  if (kidMode) {
    return (
      <div
        className="mx-3 mt-3 rounded-2xl surface-panel overflow-hidden"
        style={{
          border: "1px solid var(--color-border)",
        }}
        data-testid="practice-toolbar"
      >
        <div
          className="flex items-center gap-3 px-4 py-2.5"
          style={{ minHeight: 44 }}
        >
          <PracticeModeSelector />
        </div>
      </div>
    );
  }

  if (!compact) {
    return (
      <div
        className="mx-3 mt-3 rounded-2xl surface-panel overflow-hidden"
        style={{
          border: "1px solid var(--color-border)",
        }}
        data-testid="practice-toolbar"
      >
        <div
          className="flex flex-wrap items-center gap-3 px-4 py-2.5"
          style={{ minHeight: 44 }}
        >
          <PracticeModeSelector />

          <div
            className="hidden sm:block h-5 w-px shrink-0"
            style={{ background: "var(--color-border)" }}
          />

          <SpeedSlider />

          <div
            className="hidden sm:block h-5 w-px shrink-0"
            style={{ background: "var(--color-border)" }}
          />

          <ABLoopSelector />
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-3 mt-2 rounded-2xl surface-panel overflow-hidden"
      style={{
        border: "1px solid var(--color-border)",
      }}
      data-testid="practice-toolbar"
    >
      <div
        className="flex flex-wrap items-start gap-2 px-3 py-2.5"
        style={{ minHeight: 42 }}
      >
        <PracticeModeSelector />

        <div
          className="hidden xl:block h-5 w-px shrink-0 mt-2"
          style={{ background: "var(--color-border)" }}
        />

        <div className="flex-1 min-w-[260px]">
          <SpeedSlider />
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="btn-surface-themed ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-body font-semibold cursor-pointer"
          data-testid="practice-toolbar-advanced-toggle"
          aria-expanded={showAdvanced}
          aria-label={
            showAdvanced
              ? t("practice.hideAdvanced")
              : t("practice.showAdvanced")
          }
        >
          <span>{t("practice.more")}</span>
          {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {showAdvanced && (
        <div
          className="border-t px-3 pb-2.5 pt-2"
          style={{
            borderColor: "var(--color-border)",
            background:
              "color-mix(in srgb, var(--color-surface-alt) 34%, var(--color-surface))",
          }}
        >
          <div className="surface-elevated rounded-xl p-2">
            <ABLoopSelector />
          </div>
        </div>
      )}
    </div>
  );
}
