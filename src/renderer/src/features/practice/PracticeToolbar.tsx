import { PracticeModeSelector } from "./PracticeModeSelector";
import { SpeedSlider } from "./SpeedSlider";
import { ABLoopSelector } from "./ABLoopSelector";
import { TrackSelector } from "./TrackSelector";

export function PracticeToolbar(): React.JSX.Element {
  return (
    <div
      className="flex items-start gap-6 px-4 py-2.5 overflow-x-auto"
      style={{
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      <PracticeModeSelector />
      <SpeedSlider />
      <ABLoopSelector />
      <TrackSelector />
    </div>
  );
}
