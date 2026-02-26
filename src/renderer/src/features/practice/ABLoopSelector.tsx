import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";

// eslint-disable-next-line react-refresh/only-export-components
export function fmtSec(s: number): string {
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function ABLoopSelector(): React.JSX.Element {
  const loopRange = usePracticeStore((s) => s.loopRange);
  const setLoopRange = usePracticeStore((s) => s.setLoopRange);
  const currentTime = usePlaybackStore((s) => s.currentTime);

  const hasA = loopRange !== null;
  const hasB = loopRange !== null && loopRange[1] > loopRange[0];

  const handleA = (): void => {
    if (loopRange) {
      // Update A point, keep B if it's still ahead
      setLoopRange([currentTime, Math.max(currentTime + 0.1, loopRange[1])]);
    } else {
      // Set A point, B defaults to same (incomplete loop)
      setLoopRange([currentTime, currentTime]);
    }
  };

  const handleB = (): void => {
    if (loopRange) {
      const start = loopRange[0];
      // B must be after A
      setLoopRange([start, Math.max(start + 0.1, currentTime)]);
    } else {
      // No A set yet — use 0 as A
      setLoopRange([0, currentTime]);
    }
  };

  const handleClear = (): void => {
    setLoopRange(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[10px] font-mono uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        A–B Loop
      </span>

      <div className="flex items-center gap-1.5">
        {/* Set A */}
        <button
          onClick={handleA}
          className="px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all duration-150 cursor-pointer"
          style={{
            background: hasA
              ? "var(--color-accent)"
              : "var(--color-surface-alt)",
            color: hasA ? "#fff" : "var(--color-text-muted)",
          }}
          title="Set loop start to current position"
          aria-label="Set loop start point"
        >
          A
        </button>

        {/* Set B */}
        <button
          onClick={handleB}
          className="px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all duration-150 cursor-pointer"
          style={{
            background: hasB
              ? "var(--color-accent)"
              : "var(--color-surface-alt)",
            color: hasB ? "#fff" : "var(--color-text-muted)",
          }}
          title="Set loop end to current position"
          aria-label="Set loop end point"
        >
          B
        </button>

        {/* Range display */}
        {loopRange && (
          <span
            className="text-[11px] font-mono tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            {fmtSec(loopRange[0])}–{fmtSec(loopRange[1])}
          </span>
        )}

        {/* Clear */}
        {loopRange && (
          <button
            onClick={handleClear}
            className="px-2 py-1 rounded text-[11px] font-body transition-colors duration-150 cursor-pointer"
            style={{
              background: "var(--color-surface-alt)",
              color: "var(--color-text-muted)",
            }}
            title="Clear A–B loop"
            aria-label="Clear loop"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
