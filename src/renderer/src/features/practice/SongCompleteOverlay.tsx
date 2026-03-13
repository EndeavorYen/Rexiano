import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { RotateCcw, ArrowLeft, Star } from "lucide-react";

interface SongCompleteOverlayProps {
  onPlayAgain: () => void;
  onBackToLibrary: () => void;
}

/**
 * Sparkle positions distributed around the card for 3-star celebration.
 * Each entry: [top%, left%, horizontal drift direction, delay in ms]
 */
const SPARKLE_CONFIGS: Array<[number, number, number, number]> = [
  [8, 12, -18, 0],
  [5, 38, -6, 120],
  [3, 62, 8, 240],
  [10, 85, 16, 80],
  [75, 8, -14, 200],
  [80, 50, 4, 320],
  [70, 88, 12, 160],
  [45, 3, -20, 280],
];

function useCountUp(target: number, durationMs: number = 1000): number {
  const [value, setValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = performance.now();
    let rafId: number;

    const tick = (now: number): void => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out cubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [target, durationMs]);

  return value;
}

export function SongCompleteOverlay({
  onPlayAgain,
  onBackToLibrary,
}: SongCompleteOverlayProps): React.JSX.Element {
  const { t } = useTranslation();
  const score = usePracticeStore((s) => s.score);
  const mode = usePracticeStore((s) => s.mode);
  const showScore = mode !== "watch" && score.totalNotes > 0;

  const starCount =
    score.accuracy >= 90
      ? 3
      : score.accuracy >= 70
        ? 2
        : score.accuracy >= 40
          ? 1
          : 0;

  const animatedAccuracy = useCountUp(Math.round(score.accuracy), 1000);

  const tierMessage =
    mode === "watch"
      ? t("practice.complete.niceListening")
      : starCount === 3
        ? t("practice.complete.amazing")
        : starCount === 2
          ? t("practice.complete.great")
          : starCount >= 1
            ? t("practice.complete.good")
            : t("practice.complete.tryAgain");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        onBackToLibrary();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBackToLibrary]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop-cinematic animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Song complete"
    >
      {/* Sparkles for 3-star results */}
      {showScore && starCount === 3 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {SPARKLE_CONFIGS.map(([top, left, dx, delay], i) => (
            <span
              key={i}
              className="absolute animate-sparkle-float rounded-full"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                width: i % 2 === 0 ? "6px" : "5px",
                height: i % 2 === 0 ? "6px" : "5px",
                background:
                  i % 3 === 0
                    ? "var(--color-accent)"
                    : "var(--color-streak-gold, #C89C49)",
                animationDelay: `${delay + 400}ms`,
                ["--sparkle-dx" as string]: `${dx}px`,
                boxShadow:
                  i % 2 === 0
                    ? "0 0 8px var(--color-accent)"
                    : "0 0 8px var(--color-streak-gold, #C89C49)",
              }}
            />
          ))}
        </div>
      )}

      <div
        className="modal-card-cinematic rounded-2xl px-10 py-8 text-center max-w-sm w-full mx-4 animate-scale-in relative"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 94%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow:
            "0 24px 64px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        {/* Stars */}
        {showScore && starCount > 0 && (
          <div className="flex justify-center gap-2 mb-3">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="animate-combo-pop"
                style={{
                  animationDelay: `${i * 180}ms`,
                  animationFillMode: "both",
                  display: "inline-flex",
                }}
              >
                <Star
                  size={40}
                  fill={i <= starCount ? "var(--color-accent)" : "none"}
                  stroke={
                    i <= starCount
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)"
                  }
                  strokeWidth={1.5}
                  className={i <= starCount ? "animate-star-glow" : ""}
                  style={
                    i <= starCount
                      ? {
                          filter:
                            "drop-shadow(0 0 6px var(--color-streak-gold, #C89C49))",
                        }
                      : undefined
                  }
                />
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <div
          className="text-3xl font-display font-bold mb-1"
          style={{ color: "var(--color-text)" }}
        >
          {mode === "watch"
            ? t("practice.watchComplete")
            : t("practice.songComplete")}
        </div>

        {/* Tier-based encouraging message */}
        <div
          className="font-display font-semibold text-lg mb-2 animate-fade-in"
          style={{
            color: "var(--color-accent)",
            animationDelay: "400ms",
            animationFillMode: "both",
          }}
        >
          {tierMessage}
        </div>

        {/* Score section */}
        {showScore && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-baseline justify-center gap-2">
              <span
                className="text-4xl font-display font-bold tabular-nums"
                style={{ color: "var(--color-accent)" }}
              >
                {animatedAccuracy}%
              </span>
              <span
                className="text-sm font-body"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("practice.finalAccuracy")}
              </span>
            </div>

            <div className="flex items-baseline justify-center gap-2">
              {score.bestStreak >= 5 && (
                <span className="text-xl" role="img" aria-label="fire">
                  {"\uD83D\uDD25"}
                </span>
              )}
              <span
                className="text-xl font-display font-bold tabular-nums"
                style={{
                  color: "var(--color-streak-gold, var(--color-accent))",
                }}
              >
                {score.bestStreak}
              </span>
              <span
                className="text-sm font-body"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("practice.bestStreak")}
              </span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={onPlayAgain}
            className="btn-primary-themed flex items-center gap-2 rounded-xl px-5 py-2.5 font-display font-semibold cursor-pointer"
          >
            <RotateCcw size={16} />
            {t("practice.playAgain")}
          </button>
          <button
            onClick={onBackToLibrary}
            className="btn-surface-themed flex items-center gap-2 rounded-xl px-5 py-2.5 font-display font-semibold cursor-pointer"
          >
            <ArrowLeft size={16} />
            {t("practice.backToLibrary")}
          </button>
        </div>
      </div>
    </div>
  );
}
