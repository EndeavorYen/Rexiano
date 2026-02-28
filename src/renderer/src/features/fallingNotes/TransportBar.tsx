import { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  Timer,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { VolumeControl } from "@renderer/features/audio/VolumeControl";
import { MetronomePulse } from "@renderer/features/metronome/MetronomePulse";
import { useMetronomeBeat } from "@renderer/hooks/useMetronomeBeat";

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

export function TransportBar(): React.JSX.Element {
  const song = useSongStore((s) => s.song);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const setPlaying = usePlaybackStore((s) => s.setPlaying);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const reset = usePlaybackStore((s) => s.reset);
  const audioStatus = usePlaybackStore((s) => s.audioStatus);

  const loopRange = usePracticeStore((s) => s.loopRange);

  const metronomeEnabled = useSettingsStore((s) => s.metronomeEnabled);
  const setMetronomeEnabled = useSettingsStore((s) => s.setMetronomeEnabled);

  const metronomeBeat = useMetronomeBeat();

  const duration = song?.duration ?? 0;
  const loopHighlight = computeLoopHighlight(loopRange, duration);

  const bpm =
    song?.tempos && song.tempos.length > 0
      ? Math.round(song.tempos[0].bpm)
      : null;

  const [playPulse, setPlayPulse] = useState(false);

  const handlePlayPause = (): void => {
    setPlaying(!isPlaying);
    setPlayPulse(true);
    setTimeout(() => setPlayPulse(false), 300);
  };

  return (
    <div
      className="transport-strip"
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 16,
        padding: "8px 16px",
        background:
          "linear-gradient(to bottom, color-mix(in srgb, var(--color-surface) 95%, var(--color-bg)), var(--color-surface))",
        borderTop: "1px solid var(--color-border)",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Left: Playback controls ── */}
      <div className="flex items-center gap-2">
        {/* Play / Pause — hero button */}
        <button
          onClick={handlePlayPause}
          disabled={!song}
          className="flex items-center justify-center rounded-full text-white disabled:opacity-40 cursor-pointer"
          style={{
            width: 40,
            height: 40,
            background: "var(--color-accent)",
            boxShadow: playPulse
              ? "0 0 0 6px color-mix(in srgb, var(--color-accent) 25%, transparent)"
              : "0 2px 8px color-mix(in srgb, var(--color-accent) 30%, transparent)",
            transition: "box-shadow 0.3s ease, transform 0.1s ease",
            transform: playPulse ? "scale(0.93)" : "scale(1)",
          }}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause size={18} fill="currentColor" />
          ) : (
            <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />
          )}
        </button>

        {/* Reset */}
        <button
          onClick={reset}
          disabled={!song}
          className="flex items-center justify-center rounded-lg disabled:opacity-40 cursor-pointer"
          style={{
            width: 32,
            height: 32,
            background: "var(--color-surface-alt)",
            color: "var(--color-text-muted)",
            transition: "background 0.15s, color 0.15s",
          }}
          title="Back to start (Home)"
          aria-label="Reset to beginning"
        >
          <SkipBack size={14} fill="currentColor" />
        </button>

        {/* Metronome toggle */}
        <button
          onClick={() => setMetronomeEnabled(!metronomeEnabled)}
          className="flex items-center justify-center rounded-lg cursor-pointer"
          style={{
            width: 32,
            height: 32,
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
          title={metronomeEnabled ? "Disable metronome" : "Enable metronome"}
          aria-label={
            metronomeEnabled ? "Disable metronome" : "Enable metronome"
          }
          data-testid="metronome-toggle"
        >
          <Timer size={14} />
        </button>

        {/* Metronome beat indicator */}
        <MetronomePulse
          isPlaying={metronomeBeat.isRunning}
          currentBeat={metronomeBeat.currentBeat}
          beatsPerMeasure={metronomeBeat.beatsPerMeasure}
        />

        {/* Audio loading / error status */}
        {audioStatus === "loading" && (
          <span
            className="flex items-center gap-1 text-xs font-body"
            style={{ color: "var(--color-text-muted)" }}
            aria-label="Audio loading"
            data-testid="audio-status-loading"
          >
            <Loader2 size={13} className="animate-spin" />
            Loading
          </span>
        )}
        {audioStatus === "error" && (
          <span
            className="flex items-center gap-1 text-xs font-body"
            style={{ color: "var(--color-error, #e53e3e)" }}
            aria-label="Audio error"
            data-testid="audio-status-error"
          >
            <AlertCircle size={13} />
            Error
          </span>
        )}
      </div>

      {/* ── Center: Seek bar + time ── */}
      <div className="flex items-center gap-3">
        {/* Current time */}
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

        {/* Seek slider with A-B loop highlight */}
        <div className="relative flex-1 flex items-center" style={{ height: 20 }}>
          {/* A-B loop highlight overlay */}
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
            aria-label="Seek position"
          />
        </div>

        {/* Duration */}
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

      {/* ── Right: Volume + BPM ── */}
      <div className="flex items-center gap-3">
        {/* BPM badge */}
        {bpm && (
          <span
            className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded"
            style={{
              color: "var(--color-text-muted)",
              background: "var(--color-surface-alt)",
            }}
          >
            {bpm}
          </span>
        )}

        {/* Volume */}
        <VolumeControl />
      </div>
    </div>
  );
}
