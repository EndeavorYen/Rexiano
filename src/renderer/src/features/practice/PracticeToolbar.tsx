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

        <div
          className="hidden sm:block h-5 w-px shrink-0"
          style={{ background: "var(--color-border)" }}
        />

        <ABLoopSelector />

        <div
          className="hidden sm:block h-5 w-px shrink-0"
          style={{ background: "var(--color-border)" }}
        />

        <TrackSelector />
      </div>
    </div>
  );
}
