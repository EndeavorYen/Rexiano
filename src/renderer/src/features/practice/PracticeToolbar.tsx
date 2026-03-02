import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { PracticeModeSelector } from "./PracticeModeSelector";
import { SpeedSlider } from "./SpeedSlider";
import { ABLoopSelector } from "./ABLoopSelector";
import { TrackSelector } from "./TrackSelector";

interface PracticeToolbarProps {
  compact?: boolean;
}

export function PracticeToolbar({
  compact = false,
}: PracticeToolbarProps): React.JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`mx-3 rounded-2xl surface-panel overflow-hidden ${
        compact ? "mt-2" : "mt-3"
      }`}
      style={{
        border: "1px solid var(--color-border)",
      }}
      data-testid="practice-toolbar"
    >
      <div
        className={`flex flex-wrap items-center px-4 ${
          compact ? "gap-2 py-2" : "gap-3 py-2.5"
        }`}
        style={{ minHeight: compact ? 42 : 44 }}
      >
        <PracticeModeSelector />

        <div
          className="hidden sm:block h-5 w-px shrink-0"
          style={{ background: "var(--color-border)" }}
        />

        <SpeedSlider />

        <span
          className="text-[10px] font-body font-medium rounded-full px-2 py-0.5"
          style={{
            color: "var(--color-text-muted)",
            background:
              "color-mix(in srgb, var(--color-surface-alt) 74%, var(--color-surface))",
            border: "1px solid var(--color-border)",
          }}
          data-testid="practice-toolbar-level"
        >
          {expanded ? t("settings.advancedMode") : t("settings.basicMode")}
        </span>

        <div className="ml-auto shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className={`btn-surface-themed flex items-center gap-1.5 rounded-md font-body cursor-pointer ${
              compact ? "px-2 py-[3px] text-[10px]" : "px-2.5 py-1 text-[11px]"
            }`}
            style={{
              color: "var(--color-text-muted)",
              background: expanded
                ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
                : undefined,
            }}
            aria-expanded={expanded}
            aria-label={
              expanded ? t("practice.hideAdvanced") : t("practice.showAdvanced")
            }
          >
            <span
              className={`status-dot ${expanded ? "status-dot-live" : "status-dot-idle"}`}
            />
            {t("practice.more")}
            {expanded ? (
              <ChevronUp
                size={13}
                style={{ transform: "translateY(-0.5px)" }}
              />
            ) : (
              <ChevronDown
                size={13}
                style={{ transform: "translateY(0.5px)" }}
              />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          className={`flex items-start px-4 overflow-x-auto animate-page-enter ${
            compact ? "gap-5 pb-2" : "gap-6 pb-2.5"
          }`}
          style={{
            borderTop:
              "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)",
            background:
              "color-mix(in srgb, var(--color-surface-alt) 38%, var(--color-surface))",
          }}
        >
          <ABLoopSelector />

          <div
            className="hidden sm:block h-8 w-px shrink-0 self-center"
            style={{ background: "var(--color-border)" }}
          />

          <TrackSelector />
        </div>
      )}
    </div>
  );
}
