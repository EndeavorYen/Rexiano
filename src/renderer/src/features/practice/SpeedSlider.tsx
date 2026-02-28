import { usePracticeStore } from "@renderer/stores/usePracticeStore";

/** Primary presets shown as big buttons */
const mainPresets = [0.5, 0.75, 1.0] as const;

/** Full range for the continuous slider */
const SPEED_MIN = 0.25;
const SPEED_MAX = 2.0;
const SPEED_STEP = 0.05;

// eslint-disable-next-line react-refresh/only-export-components
export function formatSpeed(v: number): string {
  return v === Math.floor(v) ? `${v}.0x` : `${v}x`;
}

function presetLabel(v: number): string {
  if (v === 1) return "1x";
  return `${Math.round(v * 100)}%`;
}

export function SpeedSlider(): React.JSX.Element {
  const speed = usePracticeStore((s) => s.speed);
  const setSpeed = usePracticeStore((s) => s.setSpeed);

  const isCustomSpeed = !mainPresets.some((v) => Math.abs(speed - v) < 0.001);

  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[10px] font-mono uppercase tracking-wider shrink-0"
        style={{ color: "var(--color-text-muted)" }}
      >
        Speed
      </span>

      {/* Main preset buttons */}
      <div className="flex items-center gap-1">
        {mainPresets.map((v) => {
          const isActive = Math.abs(speed - v) < 0.001;
          return (
            <button
              key={v}
              onClick={() => setSpeed(v)}
              className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold cursor-pointer"
              style={{
                background: isActive
                  ? "var(--color-accent)"
                  : "var(--color-surface-alt)",
                color: isActive ? "#fff" : "var(--color-text-muted)",
                boxShadow: isActive
                  ? "0 1px 4px rgba(0,0,0,0.12)"
                  : "none",
                transition: "all 0.15s ease",
              }}
              aria-label={`Set speed to ${v}x`}
              aria-pressed={isActive}
            >
              {presetLabel(v)}
            </button>
          );
        })}
      </div>

      {/* Continuous slider */}
      <input
        type="range"
        min={SPEED_MIN}
        max={SPEED_MAX}
        step={SPEED_STEP}
        value={speed}
        onChange={(e) => setSpeed(parseFloat(e.target.value))}
        className="h-1"
        style={{ accentColor: "var(--color-accent)", width: 80 }}
        aria-label="Playback speed"
      />

      {/* Current speed display (when using slider for custom speed) */}
      {isCustomSpeed && (
        <span
          className="text-[11px] font-mono tabular-nums"
          style={{ color: "var(--color-accent)" }}
        >
          {formatSpeed(speed)}
        </span>
      )}
    </div>
  );
}
