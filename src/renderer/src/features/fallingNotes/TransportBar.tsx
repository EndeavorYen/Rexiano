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

  return (
    <div
      className="flex items-center gap-3 px-4 py-2"
      style={{
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      {/* Play / Pause */}
      <button
        onClick={() => setPlaying(!isPlaying)}
        disabled={!song}
        className="w-8 h-8 flex items-center justify-center rounded text-white disabled:opacity-40 transition-colors cursor-pointer"
        style={{ background: "var(--color-accent)" }}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" />
        )}
      </button>

      {/* Audio loading / error status */}
      {audioStatus === "loading" && (
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--color-text-muted)" }}
          aria-label="Audio loading"
          data-testid="audio-status-loading"
        >
          <Loader2 size={14} className="animate-spin" />
          Loading...
        </span>
      )}
      {audioStatus === "error" && (
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--color-error, #e53e3e)" }}
          aria-label="Audio error"
          data-testid="audio-status-error"
        >
          <AlertCircle size={14} />
          Audio error
        </span>
      )}

      {/* Reset */}
      <button
        onClick={reset}
        disabled={!song}
        className="w-8 h-8 flex items-center justify-center rounded disabled:opacity-40 transition-colors cursor-pointer"
        style={{
          background: "var(--color-surface-alt)",
          color: "var(--color-text)",
        }}
        title="Back to start (Home)"
        aria-label="Reset to beginning"
      >
        <SkipBack size={14} fill="currentColor" />
      </button>

      {/* Metronome toggle */}
      <button
        onClick={() => setMetronomeEnabled(!metronomeEnabled)}
        className="w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer"
        style={{
          background: metronomeEnabled
            ? "var(--color-accent)"
            : "var(--color-surface-alt)",
          color: metronomeEnabled ? "#fff" : "var(--color-text-secondary)",
        }}
        title={metronomeEnabled ? "Disable metronome" : "Enable metronome"}
        aria-label={metronomeEnabled ? "Disable metronome" : "Enable metronome"}
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

      {/* Time display */}
      <span
        className="text-xs tabular-nums w-20 text-center"
        style={{ color: "var(--color-text-muted)" }}
      >
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      {/* Seek slider with optional A-B loop highlight */}
      <div className="relative flex-1 flex items-center">
        {/* A-B loop highlight overlay */}
        {loopHighlight && (
          <div
            className="absolute top-0 bottom-0 rounded-sm pointer-events-none"
            style={{
              left: `${loopHighlight.left}%`,
              width: `${loopHighlight.width}%`,
              background: "var(--color-accent)",
              opacity: 0.2,
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
          className="w-full h-1 relative z-10"
          style={{ accentColor: "var(--color-accent)" }}
          aria-label="Seek position"
        />
      </div>

      {/* Volume */}
      <VolumeControl />
    </div>
  );
}
