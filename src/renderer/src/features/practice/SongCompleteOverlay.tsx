import { useEffect } from "react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { RotateCcw, ArrowLeft, Star } from "lucide-react";

interface SongCompleteOverlayProps {
  onPlayAgain: () => void;
  onBackToLibrary: () => void;
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center modal-backdrop-cinematic animate-fade-in">
      <div
        className="modal-card-cinematic rounded-2xl px-10 py-8 text-center max-w-sm w-full mx-4 animate-scale-in"
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
                  size={32}
                  fill={i <= starCount ? "var(--color-accent)" : "none"}
                  stroke={
                    i <= starCount
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)"
                  }
                  strokeWidth={1.5}
                />
              </span>
            ))}
          </div>
        )}

        <div
          className="text-3xl font-display font-bold mb-2"
          style={{ color: "var(--color-text)" }}
        >
          {mode === "watch"
            ? t("practice.watchComplete")
            : t("practice.songComplete")}
        </div>

        {showScore && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-baseline justify-center gap-2">
              <span
                className="text-4xl font-display font-bold tabular-nums"
                style={{ color: "var(--color-accent)" }}
              >
                {Math.round(score.accuracy)}%
              </span>
              <span
                className="text-sm font-body"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("practice.finalAccuracy")}
              </span>
            </div>

            <div className="flex items-baseline justify-center gap-2">
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
