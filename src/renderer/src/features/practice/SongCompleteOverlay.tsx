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
  const safeTarget = Number.isFinite(target) ? target : 0;
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
      setValue(Math.round(eased * safeTarget));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [safeTarget, durationMs]);

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
      data-testid="song-complete-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop-cinematic animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "watch"
          ? t("practice.watchComplete")
          : t("practice.songComplete")
      }
    >
      {/* Sparkles for 3-star results */}
      {showScore && starCount === 3 && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
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
                    : "var(--color-streak-gold)",
                animationDelay: `${delay + 400}ms`,
                ["--sparkle-dx" as string]: `${dx}px`,
                boxShadow:
                  i % 2 === 0
                    ? "0 0 8px var(--color-accent)"
                    : "0 0 8px var(--color-streak-gold)",
              }}
            />
          ))}
        </div>
      )}

      <div
        className="modal-card-cinematic rounded-2xl px-10 py-8 text-center max-w-sm w-full mx-4 animate-scale-in relative subtle-shadow-md"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 94%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {/* Stars — the hero element, larger with staggered entrance */}
        {showScore && starCount > 0 && (
          <div className="flex justify-center gap-3 mb-2">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="animate-star-land"
                style={{
                  animationDelay: `${i * 200}ms`,
                  animationFillMode: "both",
                  display: "inline-flex",
                }}
              >
                <Star
                  size={48}
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
                            "drop-shadow(0 0 8px var(--color-streak-gold))",
                        }
                      : undefined
                  }
                />
              </span>
            ))}
          </div>
        )}

        {/* Tier message — the emotional punch, appears after stars land */}
        <div
          className="font-display font-bold text-xl mb-1 animate-fade-in"
          style={{
            color: "var(--color-accent)",
            animationDelay: showScore && starCount > 0 ? "700ms" : "200ms",
            animationFillMode: "both",
          }}
        >
          {tierMessage}
        </div>

        {/* Structural title — smaller, muted, below the emotional message */}
        <div
          className="text-sm font-display font-semibold mb-1 animate-fade-in"
          style={{
            color: "var(--color-text-muted)",
            animationDelay: showScore && starCount > 0 ? "800ms" : "300ms",
            animationFillMode: "both",
          }}
        >
          {mode === "watch"
            ? t("practice.watchComplete")
            : t("practice.songComplete")}
        </div>

        {/* Accuracy — celebration-sized number with delayed reveal */}
        {showScore && (
          <div
            className="mt-5 animate-fade-in"
            style={{ animationDelay: "900ms", animationFillMode: "both" }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span
                className="text-5xl font-display font-bold tabular-nums leading-none animate-accuracy-reveal"
                style={{
                  color: "var(--color-text)",
                  animationDelay: "950ms",
                  animationFillMode: "both",
                }}
              >
                {animatedAccuracy}
                <span
                  className="text-3xl"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  %
                </span>
              </span>
              <span
                className="text-xs font-body tracking-wide uppercase"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("practice.finalAccuracy")}
              </span>
            </div>

            {/* Best streak — only visually prominent when earned (≥3) */}
            {score.bestStreak >= 3 && (
              <div
                className="flex items-center justify-center gap-1.5 mt-3 animate-fade-in"
                style={{
                  animationDelay: "1200ms",
                  animationFillMode: "both",
                }}
              >
                {score.bestStreak >= 5 && (
                  <span className="text-lg" role="img" aria-label="fire">
                    {"\uD83D\uDD25"}
                  </span>
                )}
                <span
                  className="text-lg font-display font-bold tabular-nums"
                  style={{ color: "var(--color-streak-gold)" }}
                >
                  {Math.max(0, score.bestStreak)}
                </span>
                <span
                  className="text-xs font-body"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {t("practice.bestStreak")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Buttons — delayed entrance after all data reveals */}
        <div
          className="mt-6 flex gap-3 justify-center animate-fade-in"
          style={{
            animationDelay: showScore ? "1400ms" : "500ms",
            animationFillMode: "both",
          }}
        >
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
