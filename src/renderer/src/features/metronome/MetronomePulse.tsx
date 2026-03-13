// ─── Phase 6.5: MetronomePulse — Visual beat indicator ───
//
// Renders a horizontal row of dots representing beats in a measure.
// The current beat is highlighted with a scale-up animation:
//   - Beat 0 (strong beat) uses the accent color
//   - Other beats use the text color
//   - Inactive dots are dimmed with low opacity
//
// Intended for embedding in TransportBar, near the metronome toggle.

import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { getDotColor, getDotOpacity, getDotSize } from "./metronomePulseUtils";

export interface MetronomePulseProps {
  isPlaying: boolean;
  currentBeat: number; // 0-indexed
  beatsPerMeasure: number; // typically 4
}

export function MetronomePulse({
  isPlaying,
  currentBeat,
  beatsPerMeasure,
}: MetronomePulseProps): React.JSX.Element | null {
  const metronomeEnabled = useSettingsStore((s) => s.metronomeEnabled);

  if (!metronomeEnabled || !isPlaying) return null;

  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label={`Beat ${currentBeat + 1} of ${beatsPerMeasure}`}
      data-testid="metronome-pulse"
    >
      {Array.from({ length: beatsPerMeasure }, (_, i) => {
        const isActive = i === currentBeat;
        const size = getDotSize(isActive);
        const color = getDotColor(i, isActive);
        const opacity = getDotOpacity(isActive);

        return (
          <span
            key={i}
            data-testid={`beat-dot-${i}`}
            style={{
              display: "inline-block",
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity,
              transition:
                "opacity 150ms ease-out, background-color 150ms ease-out",
            }}
          />
        );
      })}
    </div>
  );
}
