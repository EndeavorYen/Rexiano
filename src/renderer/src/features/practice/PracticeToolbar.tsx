import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { PracticeModeSelector } from "./PracticeModeSelector";
import { SpeedSlider } from "./SpeedSlider";
import { ABLoopSelector } from "./ABLoopSelector";
import { TrackSelector } from "./TrackSelector";
import { getSongPracticeSetupFixPrompt } from "./songPracticeSetup";

interface PracticeToolbarProps {
  compact?: boolean;
}

export interface PracticeToolbarControlVisibilityInput {
  childFocusMode: boolean;
}

export interface PracticeToolbarControlVisibility {
  showModeSelector: boolean;
  showSpeedControl: boolean;
  showAdvancedDisclosure: boolean;
  showAdvancedControls: boolean;
}

export interface PracticeToolbarInitialExpandedInput {
  childFocusMode: boolean;
  needsSongSetupFix: boolean;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getPracticeToolbarControlVisibility({
  childFocusMode,
}: PracticeToolbarControlVisibilityInput): PracticeToolbarControlVisibility {
  return {
    showModeSelector: true,
    showSpeedControl: true,
    showAdvancedDisclosure: !childFocusMode,
    showAdvancedControls: !childFocusMode,
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function getPracticeToolbarInitialExpanded({
  childFocusMode,
  needsSongSetupFix,
}: PracticeToolbarInitialExpandedInput): boolean {
  return !childFocusMode && needsSongSetupFix;
}

export function PracticeToolbar({
  compact = false,
}: PracticeToolbarProps): React.JSX.Element {
  const { t } = useTranslation();
  const childFocusMode = useSettingsStore((s) => s.childFocusMode);
  const song = useSongStore((s) => s.song);
  const needsSongSetupFix = useMemo(
    () => (song ? getSongPracticeSetupFixPrompt(song).needed : false),
    [song],
  );
  const [userExpanded, setUserExpanded] = useState(false);
  const setupExpanded = getPracticeToolbarInitialExpanded({
    childFocusMode,
    needsSongSetupFix,
  });
  const expanded = userExpanded || setupExpanded;
  const controlVisibility = getPracticeToolbarControlVisibility({
    childFocusMode,
  });
  const toolbarLevelLabel = needsSongSetupFix
    ? t("practice.fixSong")
    : expanded
      ? t("settings.advancedMode")
      : t("settings.basicMode");
  const toggleExpanded = (): void => {
    if (setupExpanded) return;
    setUserExpanded((current) => !current);
  };

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
        {controlVisibility.showModeSelector && <PracticeModeSelector />}

        <div
          className="hidden sm:block h-5 w-px shrink-0"
          style={{ background: "var(--color-border)" }}
        />

        {controlVisibility.showSpeedControl && <SpeedSlider />}

        {controlVisibility.showAdvancedDisclosure && (
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
            {toolbarLevelLabel}
          </span>
        )}

        {controlVisibility.showAdvancedDisclosure && (
          <div className="ml-auto shrink-0">
            <button
              onClick={toggleExpanded}
              className={`btn-surface-themed flex items-center gap-1.5 rounded-md font-body cursor-pointer ${
                compact
                  ? "px-2 py-[3px] text-[10px]"
                  : "px-2.5 py-1 text-[11px]"
              }`}
              style={{
                color: "var(--color-text-muted)",
                background: expanded
                  ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
                  : undefined,
              }}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? t("practice.hideAdvanced")
                  : t("practice.showAdvanced")
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
        )}
        {!controlVisibility.showAdvancedDisclosure && (
          <div className="ml-auto shrink-0" />
        )}
      </div>

      {expanded && controlVisibility.showAdvancedControls && (
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
