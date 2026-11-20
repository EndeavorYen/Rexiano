import { rangeProgressStyle } from "@renderer/utils/rangeProgress";
import { VolumeX, Volume1, Volume2 } from "lucide-react";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { setSharedVolume, toggleSharedMute } from "./volumeSync";
import "../practice/play-feedback.css";

function VolumeIcon({ level }: { level: number }): React.JSX.Element {
  if (level === 0) return <VolumeX size={20} />;
  if (level <= 50) return <Volume1 size={20} />;
  return <Volume2 size={20} />;
}

/** Same volume and mute as the settings drawer: both read the settings store. */
export function VolumeControl(): React.JSX.Element {
  const { t } = useTranslation();
  const volume = useSettingsStore((s) => s.volume);
  const muted = useSettingsStore((s) => s.muted);

  const displayValue = muted ? 0 : Math.round(volume);

  return (
    <div
      className="flex min-w-0 items-center gap-1.5"
      data-testid="volume-control"
    >
      <button
        onClick={toggleSharedMute}
        className="play-icon-btn"
        style={{
          color: muted ? "var(--color-text-muted)" : "var(--color-text)",
          opacity: muted ? 0.5 : 0.92,
          transition: "opacity 0.15s, color 0.15s, background 0.15s",
        }}
        title={muted ? t("audio.unmute") : t("audio.mute")}
        aria-label={muted ? t("audio.unmute") : t("audio.mute")}
        aria-pressed={muted}
      >
        <VolumeIcon level={displayValue} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={displayValue}
        onChange={(e) => setSharedVolume(parseInt(e.target.value, 10))}
        className="volume-slider-input"
        style={{
          accentColor: "var(--color-accent)",
          width: 72,
          ...rangeProgressStyle(displayValue, 0, 100),
        }}
        aria-label={t("transport.volume")}
        title={`${t("transport.volume")}: ${displayValue}%`}
        data-testid="volume-slider"
      />
    </div>
  );
}
