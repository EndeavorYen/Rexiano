import { useEffect, useState } from "react";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { usePlaybackStore } from "@renderer/stores/usePlaybackStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { X } from "lucide-react";

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
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

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
      setLoopRange([currentTime, currentTime]);
    }
    setFlashMessage(`A ${fmtSec(currentTime)}`);
  };

  const handleB = (): void => {
    if (loopRange) {
      const start = loopRange[0];
      setLoopRange([start, Math.max(start + 0.1, currentTime)]);
      setFlashMessage(`B ${fmtSec(Math.max(start + 0.1, currentTime))}`);
    } else {
      setLoopRange([0, currentTime]);
      setFlashMessage(`B ${fmtSec(currentTime)}`);
    }
  };

  const handleClear = (): void => {
    setLoopRange(null);
    setFlashMessage(t("practice.clearLoop"));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[10px] font-mono uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {t("practice.loopSection")}
      </span>

      <div className="flex items-center gap-1.5">
        {/* Set A */}
        <button
          onClick={handleA}
          className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold cursor-pointer"
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
          className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold cursor-pointer"
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
              width: 24,
              height: 24,
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
