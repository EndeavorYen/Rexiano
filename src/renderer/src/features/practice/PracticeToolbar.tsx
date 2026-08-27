import { PracticeModeSelector } from "./PracticeModeSelector";
import { SpeedSlider } from "./SpeedSlider";

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
export function getPracticeToolbarControlVisibility(
  input?: PracticeToolbarControlVisibilityInput,
): PracticeToolbarControlVisibility {
  void input;
  return {
    showModeSelector: true,
    showSpeedControl: true,
    showAdvancedDisclosure: false,
    showAdvancedControls: false,
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
  const controlVisibility = getPracticeToolbarControlVisibility();

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
      </div>
    </div>
  );
}
