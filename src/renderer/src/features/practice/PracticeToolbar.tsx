import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { PracticeModeSelector } from "./PracticeModeSelector";
import { SpeedSlider } from "./SpeedSlider";
import { ABLoopSelector } from "./ABLoopSelector";
import { TrackSelector } from "./TrackSelector";

export function PracticeToolbar(): React.JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background:
          "linear-gradient(to bottom, var(--color-surface), color-mix(in srgb, var(--color-surface) 95%, var(--color-bg)))",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      {/* Primary row: mode selector + speed + expand toggle */}
      <div
        className="flex items-center gap-4 px-4 py-2"
        style={{ minHeight: 40 }}
      >
        <PracticeModeSelector />

        <div
          className="h-5 w-px shrink-0"
          style={{ background: "var(--color-border)" }}
        />

        <SpeedSlider />

        <div className="ml-auto shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-body cursor-pointer"
            style={{
              color: "var(--color-text-muted)",
              background: expanded
                ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                : "transparent",
              transition: "all 0.15s ease",
            }}
            aria-expanded={expanded}
            aria-label={
              expanded ? t("practice.hideAdvanced") : t("practice.showAdvanced")
            }
          >
            {t("practice.more")}
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded row: A-B loop + tracks */}
      {expanded && (
        <div className="flex items-start gap-6 px-4 pb-2 overflow-x-auto animate-page-enter">
          <ABLoopSelector />

          <div
            className="h-8 w-px shrink-0 self-center"
            style={{ background: "var(--color-border)" }}
          />

          <TrackSelector />
        </div>
      )}
    </div>
  );
}
