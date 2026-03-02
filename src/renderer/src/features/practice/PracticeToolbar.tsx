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
      className="mx-3 mt-3 rounded-2xl surface-panel overflow-hidden"
      style={{
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-2.5"
        style={{ minHeight: 42 }}
      >
        <PracticeModeSelector />

        <div
          className="hidden sm:block h-5 w-px shrink-0"
          style={{ background: "var(--color-border)" }}
        />

        <SpeedSlider />

        <div className="ml-auto shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="btn-surface-themed flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-body cursor-pointer"
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
          className="flex items-start gap-6 px-4 pb-2.5 overflow-x-auto animate-page-enter"
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
