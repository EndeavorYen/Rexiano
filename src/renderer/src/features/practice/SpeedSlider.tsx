import { usePracticeStore } from "@renderer/stores/usePracticeStore";

const presets = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0] as const;

// eslint-disable-next-line react-refresh/only-export-components
export function formatSpeed(v: number): string {
  return v === Math.floor(v) ? `${v}.0x` : `${v}x`;
}

export function SpeedSlider(): React.JSX.Element {
  const speed = usePracticeStore((s) => s.speed);
  const setSpeed = usePracticeStore((s) => s.setSpeed);

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[10px] font-mono uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Speed
      </span>

      {/* Preset buttons */}
      <div className="flex items-center gap-1">
        {presets.map((v) => {
          const isActive = Math.abs(speed - v) < 0.001;
          return (
            <button
              key={v}
              onClick={() => setSpeed(v)}
              className="px-2 py-1 rounded text-[11px] font-mono font-medium transition-all duration-150 cursor-pointer"
              style={{
                background: isActive
                  ? "var(--color-accent)"
                  : "var(--color-surface-alt)",
                color: isActive ? "#fff" : "var(--color-text-muted)",
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
              }}
              aria-label={`Set speed to ${v}x`}
              aria-pressed={isActive}
            >
              {formatSpeed(v)}
            </button>
          );
        })}
      </div>

      {/* Continuous slider */}
      <input
        type="range"
        min={0.25}
        max={2.0}
        step={0.05}
        value={speed}
        onChange={(e) => setSpeed(parseFloat(e.target.value))}
        className="w-full h-1"
        style={{ accentColor: "var(--color-accent)" }}
        aria-label="Playback speed"
      />
    </div>
  );
}
