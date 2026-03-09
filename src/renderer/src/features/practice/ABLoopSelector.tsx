/**
 * Phase 6: A-B loop selector — lets the user set loop start (A) and end (B)
 * points for focused practice of a specific passage.
 * Supports both free-form time-based and measure-based selection.
 */
import { useEffect, useState } from "react";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { X } from "lucide-react";

/** Format seconds as M:SS display string. */
// eslint-disable-next-line react-refresh/only-export-components
export function fmtSec(s: number): string {
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function ABLoopSelector(): React.JSX.Element {
  const { t } = useTranslation();
  const loopRange = usePracticeStore((s) => s.loopRange);
  const setLoopRange = usePracticeStore((s) => s.setLoopRange);
  const currentTime = usePlaybackStore((s) => s.currentTime);
  const song = useSongStore((s) => s.song);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [byMeasure, setByMeasure] = useState(false);
  const [measureA, setMeasureA] = useState(1);
  const [measureB, setMeasureB] = useState(1);

  const measureTimes = song?.measureTimes ?? [];
  const hasMeasures = measureTimes.length > 0;

  const hasA = loopRange !== null;
  const hasB = loopRange !== null && loopRange[1] > loopRange[0];

  useEffect(() => {
    if (!flashMessage) return;
    const timer = setTimeout(() => setFlashMessage(null), 1300);
    return () => clearTimeout(timer);
  }, [flashMessage]);

  const handleA = (): void => {
    if (loopRange) {
      setLoopRange([currentTime, Math.max(currentTime + 0.1, loopRange[1])]);
    } else {
      setLoopRange([currentTime, song?.duration ?? currentTime + 1]);
    }
    setFlashMessage(`A ${fmtSec(currentTime)}`);
  };

  const handleB = (): void => {
    if (loopRange) {
      const start = loopRange[0];
      setLoopRange([start, Math.max(start + 0.1, currentTime)]);
      setFlashMessage(`B ${fmtSec(Math.max(start + 0.1, currentTime))}`);
    } else {
      // No A point set yet — set A to 0 explicitly so the user knows.
      // If currentTime is very small, ensure a minimum loop length.
      const end = Math.max(0.1, currentTime);
      setLoopRange([0, end]);
      setFlashMessage(`A 0:00 → B ${fmtSec(end)}`);
    }
  };

  const handleClear = (): void => {
    setLoopRange(null);
    setByMeasure(false);
    setFlashMessage(t("practice.clearLoop"));
  };

  /** Get the end time for a given measure index (0-based). */
  const getMeasureEndTime = (measureIdx: number): number => {
    if (measureIdx + 1 < measureTimes.length) {
      return measureTimes[measureIdx + 1];
    }
    return song?.duration ?? 0;
  };

  const handleMeasureAChange = (val: number): void => {
    setMeasureA(val);
    const startTime = measureTimes[val - 1] ?? 0;
    const effectiveB = Math.max(val, measureB);
    if (effectiveB !== measureB) setMeasureB(effectiveB);
    const endTime = getMeasureEndTime(effectiveB - 1);
    setLoopRange([startTime, endTime]);
    setFlashMessage(`A: ${t("practice.loop.measure", { n: val })}`);
  };

  const handleMeasureBChange = (val: number): void => {
    setMeasureB(val);
    const effectiveA = Math.min(measureA, val);
    if (effectiveA !== measureA) setMeasureA(effectiveA);
    const startTime = measureTimes[effectiveA - 1] ?? 0;
    const endTime = getMeasureEndTime(val - 1);
    setLoopRange([startTime, endTime]);
    setFlashMessage(`B: ${t("practice.loop.measure", { n: val })}`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-mono uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("practice.loopSection")}
        </span>

        {/* By Measure toggle */}
        {hasMeasures && (
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={byMeasure}
              onChange={(e) => {
                setByMeasure(e.target.checked);
                if (e.target.checked) {
                  // Set default measure range
                  const startTime = measureTimes[measureA - 1] ?? 0;
                  const endTime = getMeasureEndTime(measureB - 1);
                  setLoopRange([startTime, endTime]);
                }
              }}
              className="accent-[var(--color-accent)] cursor-pointer"
              data-testid="by-measure-toggle"
            />
            <span
              className="text-[10px] font-body"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("practice.loop.byMeasure")}
            </span>
          </label>
        )}
      </div>

      {byMeasure && hasMeasures ? (
        /* Measure-based selection */
        <div className="flex items-center gap-1.5">
          <select
            value={measureA}
            onChange={(e) => handleMeasureAChange(parseInt(e.target.value, 10))}
            className="px-2.5 py-1.5 rounded-md text-xs font-mono cursor-pointer"
            style={{
              background: "var(--color-surface-alt)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
            aria-label={t("practice.setALabel")}
            data-testid="measure-a-select"
          >
            {measureTimes.map((_, i) => (
              <option key={i} value={i + 1}>
                {t("practice.loop.measure", { n: i + 1 })}
              </option>
            ))}
          </select>

          <span
            className="text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {"\u2192"}
          </span>

          <select
            value={measureB}
            onChange={(e) => handleMeasureBChange(parseInt(e.target.value, 10))}
            className="px-2.5 py-1.5 rounded-md text-xs font-mono cursor-pointer"
            style={{
              background: "var(--color-surface-alt)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
            aria-label={t("practice.setBLabel")}
            data-testid="measure-b-select"
          >
            {measureTimes.map((_, i) => (
              <option key={i} value={i + 1}>
                {t("practice.loop.measure", { n: i + 1 })}
              </option>
            ))}
          </select>

          {/* Clear */}
          {loopRange && (
            <button
              onClick={handleClear}
              className="flex items-center justify-center rounded-md cursor-pointer"
              style={{
                width: "1.75rem",
                height: "1.75rem",
                background: "var(--color-surface-alt)",
                color: "var(--color-text-muted)",
                transition: "color 0.15s",
              }}
              title={t("practice.clearLoop")}
              aria-label={t("practice.clearLoopLabel")}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ) : (
        /* Free-form time-based selection */
        <div className="flex items-center gap-1.5">
          {/* Set A */}
          <button
            onClick={handleA}
            className="px-3 py-1.5 rounded-md text-xs font-mono font-bold cursor-pointer"
            style={{
              background: hasA
                ? "var(--color-accent)"
                : "var(--color-surface-alt)",
              color: hasA ? "#fff" : "var(--color-text-muted)",
              border: !hasA
                ? "1px dashed var(--color-border)"
                : "1px solid transparent",
              transition: "all 0.15s ease",
            }}
            title={
              hasA ? `Loop start: ${fmtSec(loopRange![0])}` : t("practice.setA")
            }
            aria-label={t("practice.setALabel")}
          >
            A
            {hasA && (
              <span className="font-normal ml-1 opacity-80">
                {fmtSec(loopRange![0])}
              </span>
            )}
          </button>

          {/* Arrow */}
          <span
            className="text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {"\u2192"}
          </span>

          {/* Set B */}
          <button
            onClick={handleB}
            className="px-3 py-1.5 rounded-md text-xs font-mono font-bold cursor-pointer"
            style={{
              background: hasB
                ? "var(--color-accent)"
                : "var(--color-surface-alt)",
              color: hasB ? "#fff" : "var(--color-text-muted)",
              border: !hasB
                ? "1px dashed var(--color-border)"
                : "1px solid transparent",
              transition: "all 0.15s ease",
            }}
            title={
              hasB ? `Loop end: ${fmtSec(loopRange![1])}` : t("practice.setB")
            }
            aria-label={t("practice.setBLabel")}
          >
            B
            {hasB && (
              <span className="font-normal ml-1 opacity-80">
                {fmtSec(loopRange![1])}
              </span>
            )}
          </button>

          {/* Clear */}
          {loopRange && (
            <button
              onClick={handleClear}
              className="flex items-center justify-center rounded-md cursor-pointer"
              style={{
                width: "1.75rem",
                height: "1.75rem",
                background: "var(--color-surface-alt)",
                color: "var(--color-text-muted)",
                transition: "color 0.15s",
              }}
              title={t("practice.clearLoop")}
              aria-label={t("practice.clearLoopLabel")}
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      <div className="h-4">
        {flashMessage && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono tabular-nums animate-page-enter"
            style={{
              color: "var(--color-accent)",
              background:
                "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))",
              border:
                "1px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border))",
            }}
            data-testid="ab-loop-feedback"
          >
            {flashMessage}
          </span>
        )}
      </div>
    </div>
  );
}
