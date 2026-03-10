import { useCallback, useEffect, useRef } from "react";
import { VolumeX, Volume1, Volume2 } from "lucide-react";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useTranslation } from "@renderer/i18n/useTranslation";

function VolumeIcon({ level }: { level: number }): React.JSX.Element {
  if (level === 0) return <VolumeX size={15} />;
  if (level <= 50) return <Volume1 size={15} />;
  return <Volume2 size={15} />;
}

export function VolumeControl(): React.JSX.Element {
  const { t } = useTranslation();
  const volume = usePlaybackStore((s) => s.volume);
  const setVolume = usePlaybackStore((s) => s.setVolume);
  const preMuteVolume = useRef(volume > 0 ? volume : 0.8);
  useEffect(() => {
    if (volume > 0) preMuteVolume.current = volume;
  }, [volume]);

  const displayValue = Math.round(volume * 100);
  const isMuted = volume === 0;

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setVolume(preMuteVolume.current);
    } else {
      preMuteVolume.current = volume;
      setVolume(0);
    }
  }, [isMuted, volume, setVolume]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseInt(e.target.value, 10) / 100;
      setVolume(v);
      if (v > 0) {
        preMuteVolume.current = v;
      }
    },
    [setVolume],
  );

  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-1.5 py-1.5"
      style={{
        background:
          "color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-surface))",
        border: "1px solid var(--color-border)",
      }}
      data-testid="volume-control"
    >
      <button
        onClick={handleToggleMute}
        className="flex items-center justify-center rounded-md cursor-pointer"
        style={{
          width: 28,
          height: 28,
          color: isMuted ? "var(--color-text-muted)" : "var(--color-text)",
          opacity: isMuted ? 0.5 : 0.92,
          transition: "opacity 0.15s, color 0.15s, background 0.15s",
        }}
        title={isMuted ? t("audio.unmute") : t("audio.mute")}
        aria-label={isMuted ? t("audio.unmute") : t("audio.mute")}
      >
        <VolumeIcon level={displayValue} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={displayValue}
        onChange={handleVolumeChange}
        className="volume-slider-input"
        style={{ accentColor: "var(--color-accent)", width: 88 }}
        aria-label={t("transport.volume")}
        title={`${t("transport.volume")}: ${displayValue}%`}
        data-testid="volume-slider"
      />
    </div>
  );
}
