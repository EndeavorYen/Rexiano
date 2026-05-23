import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { applyPracticeSpeedChangeForSong } from "./practiceSetupControlActions";

/** Primary presets shown as big buttons */
const mainPresets = [0.5, 0.75, 1.0] as const;

/** Full range for the continuous slider */
const SPEED_MIN = 25;
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
  const song = useSongStore((s) => s.song);
  const mode = usePracticeStore((s) => s.mode);
  const activeTracks = usePracticeStore((s) => s.activeTracks);
  const speed = usePracticeStore((s) => s.speed);
  const setSpeed = usePracticeStore((s) => s.setSpeed);

  const speedPercent = Math.round(speed * 100);
  const applySpeed = (nextSpeed: number): void => {
    applyPracticeSpeedChangeForSong(
      {
        song,
        activeTracks,
        currentMode: mode,
        setSpeed,
      },
      nextSpeed,
    );
  };

  return (
    <div
      className="flex min-w-0 max-w-full flex-wrap items-center gap-2 py-0.5"
      data-testid="speed-slider-control"
    >
      <span
        className="text-[11px] font-body font-medium shrink-0"
        style={{ color: "var(--color-text-muted)" }}
      >
        {t("practice.speed")}
      </span>

      {/* Main preset buttons */}
      <div className="flex flex-wrap items-center gap-1">
        {mainPresets.map((v) => {
          const isActive = Math.abs(speed - v) < 0.001;
          return (
            <button
              key={v}
              onClick={() => applySpeed(v)}
              className="min-h-9 px-2.5 py-1 rounded-md text-[11px] font-body font-semibold tabular-nums cursor-pointer"
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
        onChange={(e) => applySpeed(parseFloat(e.target.value) / 100)}
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
