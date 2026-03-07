/**
 * ─── Phase 6: Speed Slider ──────────────────────────────────
 *
 * Speed control component with preset buttons (0.25x–1.0x)
 * and a continuous slider (10%–200%). Updates the practice
 * store speed value which feeds into the ticker loop multiplier.
 */
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useTranslation } from "@renderer/i18n/useTranslation";

/** Primary presets shown as big buttons */
const mainPresets = [0.25, 0.5, 0.75, 1.0] as const;

/** Full range for the continuous slider */
const SPEED_MIN = 10;
const SPEED_MAX = 200;
const SPEED_STEP = 5;

// eslint-disable-next-line react-refresh/only-export-components
export function formatSpeed(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function presetLabel(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export function SpeedSlider(): React.JSX.Element {
  const { t } = useTranslation();
  const speed = usePracticeStore((s) => s.speed);
  const setSpeed = usePracticeStore((s) => s.setSpeed);

  const speedPercent = Math.round(speed * 100);

  return (
    <div
      className="flex items-center gap-2.5 min-w-0 py-0.5 flex-wrap"
      data-testid="speed-slider-control"
    >
      <span
        className="text-[11px] font-body font-medium shrink-0"
        style={{ color: "var(--color-text-muted)" }}
      >
        {t("practice.speed")}
      </span>

      {/* Main preset buttons */}
      <div className="flex items-center gap-1">
        {mainPresets.map((v) => {
          const isActive = Math.abs(speed - v) < 0.001;
          return (
            <button
              key={v}
              onClick={() => setSpeed(v)}
              className="px-3 py-1.5 rounded-md text-xs font-body font-semibold tabular-nums cursor-pointer"
              style={{
                background: isActive
                  ? "var(--color-accent)"
                  : "var(--color-surface-alt)",
                color: isActive ? "#fff" : "var(--color-text-muted)",
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                transition: "all 0.15s ease",
              }}
              aria-label={`Set speed to ${presetLabel(v)}`}
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
        value={speedPercent}
        onChange={(e) => setSpeed(parseFloat(e.target.value) / 100)}
        className="speed-slider-input shrink-0"
        style={{ accentColor: "var(--color-accent)", width: 96 }}
        aria-label="Playback speed percentage"
        data-testid="speed-slider"
      />

      <span
        className="text-[11px] font-mono tabular-nums shrink-0"
        style={{ color: "var(--color-text)" }}
        data-testid="speed-slider-percent"
      >
        {formatSpeed(speed)}
      </span>
    </div>
  );
}
