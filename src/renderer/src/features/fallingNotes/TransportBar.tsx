/**
 * ─── Phase 3: Transport Bar ─────────────────────────────────
 *
 * Playback control bar with play/pause, restart, seek slider,
 * volume, metronome toggle, and MIDI device status. Sits at the
 * bottom of the falling-notes view and integrates with the
 * playback store and audio engine.
 */
import { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  Timer,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { VolumeControl } from "@renderer/features/audio/VolumeControl";
import { DifficultyHeatmap } from "@renderer/features/practice/DifficultyHeatmap";
import { MetronomePulse } from "@renderer/features/metronome/MetronomePulse";
import { useMetronomeBeat } from "@renderer/hooks/useMetronomeBeat";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { ShortcutBadge } from "@renderer/features/settings/KeyboardShortcutsHelp";

// eslint-disable-next-line react-refresh/only-export-components
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Compute the left% and width% for the A-B loop highlight overlay.
 * Returns null if loop is inactive or duration is zero.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function computeLoopHighlight(
  loopRange: [number, number] | null,
  duration: number,
): { left: number; width: number } | null {
  if (!loopRange || duration <= 0) return null;
  const [a, b] = loopRange;
  const left = Math.max(0, Math.min(100, (a / duration) * 100));
  const right = Math.max(0, Math.min(100, (b / duration) * 100));
  const width = right - left;
  if (width <= 0) return null;
  return { left, width };
}

interface TransportBarProps {
  compact?: boolean;
}

export function TransportBar({
  compact = false,
}: TransportBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const song = useSongStore((s) => s.song);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const volume = usePlaybackStore((s) => s.volume);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const reset = usePlaybackStore((s) => s.reset);
  const audioStatus = usePlaybackStore((s) => s.audioStatus);
  const audioRecoveryState = usePlaybackStore((s) => s.audioRecoveryState);
  const audioRecoveryAttempt = usePlaybackStore((s) => s.audioRecoveryAttempt);
  const audioRecoveryMaxAttempts = usePlaybackStore(
    (s) => s.audioRecoveryMaxAttempts,
  );
  const audioRecoverySuccessVisible = usePlaybackStore(
    (s) => s.audioRecoverySuccessVisible,
  );
  const requestAudioRecovery = usePlaybackStore((s) => s.requestAudioRecovery);

  const loopRange = usePracticeStore((s) => s.loopRange);

  const metronomeEnabled = useSettingsStore((s) => s.metronomeEnabled);
  const setMetronomeEnabled = useSettingsStore((s) => s.setMetronomeEnabled);

  const metronomeBeat = useMetronomeBeat();

  const duration = song?.duration ?? 0;
  const loopHighlight = computeLoopHighlight(loopRange, duration);
  const volumePercent = Math.round(volume * 100);

  const [playPulse, setPlayPulse] = useState(false);

  const handlePlayPause = (): void => {
    setPlaying(!isPlaying);
    setPlayPulse(true);
    setTimeout(() => setPlayPulse(false), 300);
  };
  const primaryButtonSize = compact ? 36 : 40;
  const iconSize = compact ? 16 : 18;
  const utilityButtonSize = compact ? 30 : 32;

  return (
    <div
      className={`transport-strip surface-panel mx-3 rounded-2xl sm:px-4 ${
        compact ? "mt-2 px-2.5 py-2" : "mt-3 px-3 py-2.5"
      }`}
      data-testid="transport-strip"
    >
      <div
        className={`grid lg:grid-cols-[auto_1fr_auto] lg:items-center ${
          compact ? "gap-1.5 lg:gap-2.5" : "gap-2 lg:gap-3"
        }`}
      >
        <div
          className={`flex items-center gap-2 overflow-x-auto lg:overflow-visible rounded-xl ${
            compact ? "px-1.5 py-0.5" : "px-1.5 py-1"
          }`}
          style={{
            background:
              "color-mix(in srgb, var(--color-surface-alt) 46%, var(--color-surface))",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="flex flex-col items-center gap-0.5">
            <button
              onClick={handlePlayPause}
              disabled={!song}
              className="flex items-center justify-center rounded-full text-white disabled:opacity-40 cursor-pointer"
              style={{
                width: primaryButtonSize,
                height: primaryButtonSize,
                background: "var(--color-accent)",
                boxShadow: playPulse
                  ? "0 0 0 6px color-mix(in srgb, var(--color-accent) 25%, transparent)"
                  : "0 2px 8px color-mix(in srgb, var(--color-accent) 30%, transparent)",
                transition: "box-shadow 0.3s ease, transform 0.1s ease",
                transform: playPulse ? "scale(0.93)" : "scale(1)",
                animation: isPlaying
                  ? "status-dot-pulse 2.6s ease-out infinite"
                  : "none",
              }}
              title={isPlaying ? t("transport.pause") : t("transport.play")}
              aria-label={
                isPlaying ? t("transport.pause") : t("transport.play")
              }
            >
              {isPlaying ? (
                <Pause size={iconSize} fill="currentColor" />
              ) : (
                <Play
                  size={iconSize}
                  fill="currentColor"
                  style={{ marginLeft: 2 }}
                />
              )}
            </button>
            {!compact && <ShortcutBadge label="Space" />}
          </div>

          <button
            onClick={reset}
            disabled={!song}
            className="btn-surface-themed flex items-center justify-center rounded-lg disabled:opacity-40 cursor-pointer"
            style={{
              width: utilityButtonSize,
              height: utilityButtonSize,
              color: "var(--color-text-muted)",
            }}
            title={t("transport.reset")}
            aria-label={t("transport.resetLabel")}
          >
            <SkipBack size={compact ? 13 : 14} fill="currentColor" />
          </button>

          <button
            onClick={() => setMetronomeEnabled(!metronomeEnabled)}
            className="flex items-center justify-center rounded-lg cursor-pointer transition-colors"
            style={{
              width: utilityButtonSize,
              height: utilityButtonSize,
              background: metronomeEnabled
                ? "color-mix(in srgb, var(--color-accent) 15%, transparent)"
                : "var(--color-surface-alt)",
              color: metronomeEnabled
                ? "var(--color-accent)"
                : "var(--color-text-muted)",
              border: metronomeEnabled
                ? "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)"
                : "1px solid transparent",
              transition: "all 0.15s ease",
            }}
            title={
              metronomeEnabled
                ? t("transport.disableMetronome")
                : t("transport.enableMetronome")
            }
            aria-label={
              metronomeEnabled
                ? t("transport.disableMetronome")
                : t("transport.enableMetronome")
            }
            data-testid="metronome-toggle"
          >
            <Timer size={compact ? 13 : 14} />
          </button>

          <div className="hidden md:block">
            <MetronomePulse
              isPlaying={metronomeBeat.isRunning}
              currentBeat={metronomeBeat.currentBeat}
              beatsPerMeasure={metronomeBeat.beatsPerMeasure}
            />
          </div>

          {audioStatus === "loading" && audioRecoveryState !== "recovering" && (
            <span
              className="control-chip text-xs font-body"
              style={{ color: "var(--color-text-muted)" }}
              aria-label="Audio loading"
              data-testid="audio-status-loading"
            >
              <span className="status-dot status-dot-live" />
              <Loader2 size={13} className="animate-spin" />
              {t("general.loading")}
            </span>
          )}
          {audioRecoveryState === "recovering" && (
            <span
              className="control-chip text-xs font-body"
              style={{ color: "var(--color-text-muted)" }}
              aria-label="Audio recovering"
              data-testid="audio-status-recovering"
            >
              <span className="status-dot status-dot-live" />
              <Loader2 size={13} className="animate-spin" />
              {t("audio.recovering", {
                attempt: audioRecoveryAttempt,
                max: audioRecoveryMaxAttempts,
              })}
            </span>
          )}
          {audioRecoveryState === "failed" && (
            <span
              className="control-chip text-xs font-body gap-1.5"
              style={{ color: "var(--color-error, #e53e3e)" }}
              aria-label="Audio recovery failed"
              data-testid="audio-status-recovery-failed"
            >
              <span className="status-dot status-dot-idle" />
              <AlertCircle size={13} />
              {t("audio.recoveryFailed")}
              <button
                onClick={() => requestAudioRecovery()}
                className="btn-surface-themed rounded-md px-2 py-0.5 text-[10px] font-body cursor-pointer"
                style={{ color: "var(--color-text)" }}
                data-testid="audio-recovery-retry"
              >
                <span className="inline-flex items-center gap-1">
                  <RotateCcw size={11} />
                  {t("audio.retry")}
                </span>
              </button>
            </span>
          )}
          {audioStatus === "error" && audioRecoveryState !== "failed" && (
            <span
              className="control-chip text-xs font-body"
              style={{ color: "var(--color-error, #e53e3e)" }}
              aria-label="Audio error"
              data-testid="audio-status-error"
            >
              <span className="status-dot status-dot-idle" />
              <AlertCircle size={13} />
              {t("general.error")}
            </span>
          )}
          {audioRecoverySuccessVisible && (
            <span
              className="control-chip text-xs font-body"
              style={{ color: "var(--color-accent)" }}
              data-testid="audio-status-recovered"
            >
              <span className="status-dot status-dot-live" />
              {t("audio.restored")}
            </span>
          )}
        </div>

        <div
          className={`flex flex-col min-w-0 lg:min-w-[280px] rounded-xl px-2 ${
            compact ? "gap-0.5 py-0.5" : "gap-1 py-1"
          }`}
          style={{
            background:
              "color-mix(in srgb, var(--color-surface) 72%, transparent)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
            <span
              className="text-xs font-mono tabular-nums shrink-0"
              style={{
                color: "var(--color-text)",
                minWidth: 36,
                textAlign: "right",
              }}
            >
              {formatTime(currentTime)}
            </span>

            <div
              className="relative flex-1 flex items-center"
              style={{ height: compact ? 18 : 20 }}
            >
              {loopHighlight && (
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: `${loopHighlight.left}%`,
                    width: `${loopHighlight.width}%`,
                    top: "50%",
                    height: 5,
                    transform: "translateY(-50%)",
                    background: `linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 40%, transparent), var(--color-accent), color-mix(in srgb, var(--color-accent) 40%, transparent))`,
                    borderRadius: 3,
                  }}
                  data-testid="loop-highlight"
                  aria-label="A-B loop range"
                />
              )}
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={currentTime}
                onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                disabled={!song}
                className="w-full relative z-10"
                style={{ accentColor: "var(--color-accent)" }}
                aria-label={t("transport.seekPosition")}
              />
            </div>

            <span
              className="text-xs font-mono tabular-nums shrink-0"
              style={{
                color: "var(--color-text-muted)",
                minWidth: 36,
              }}
            >
              {formatTime(duration)}
            </span>
          </div>

          {song && <DifficultyHeatmap />}
        </div>

        <div
          className={`flex items-center justify-end rounded-xl px-1.5 ${
            compact ? "gap-2 py-1" : "gap-2.5 py-1.5"
          }`}
          style={{
            background:
              "color-mix(in srgb, var(--color-surface-alt) 46%, var(--color-surface))",
            border: "1px solid var(--color-border)",
          }}
        >
          <span
            className="control-chip font-mono tabular-nums"
            style={{
              color: "var(--color-text-muted)",
            }}
            data-testid="transport-volume-percent"
          >
            {volumePercent}%
          </span>

          <VolumeControl />
        </div>
      </div>
    </div>
  );
}
