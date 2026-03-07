import { useMemo } from "react";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TranslationKey } from "@renderer/i18n/types";

function getEncouragementKey(accuracy: number, streak: number): TranslationKey {
  if (streak >= 25) return "practice.encourageOnFire";
  if (streak >= 10) return "practice.encourageStreak";
  if (accuracy >= 95) return "practice.encouragePerfect";
  if (accuracy >= 85) return "practice.encourageGreat";
  if (accuracy >= 70) return "practice.encourageKeepGoing";
  if (accuracy >= 50) return "practice.encourageGettingThere";
  return "practice.encourageYouCanDoIt";
}

export function ScoreOverlay(): React.JSX.Element {
  const { t } = useTranslation();
  const score = usePracticeStore((s) => s.score);
  const mode = usePracticeStore((s) => s.mode);
  const isWaiting = usePracticeStore((s) => s.isWaiting);

  // useMemo must be called before any early returns (Rules of Hooks)
  const encouragementKey = useMemo(
    () => getEncouragementKey(score.accuracy, score.currentStreak),
    [score.accuracy, score.currentStreak],
  );

  // In watch mode there's no scoring
  if (mode === "watch") return <></>;
  // Don't show overlay until practice begins
  if (score.totalNotes === 0) return <></>;

  const encouragement = t(encouragementKey);

  return (
    <div
      className="absolute top-3 right-3 z-50 flex flex-col items-end gap-1 px-4 py-3 rounded-xl pointer-events-none select-none animate-score-enter"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 80%, transparent)",
        border:
          "1px solid color-mix(in srgb, var(--color-border) 60%, transparent)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      role="status"
      aria-label={t("practice.scoreLabel")}
    >
      {/* Wait mode indicator */}
      {isWaiting && (
        <span
          className="text-xs font-display font-bold animate-pulse"
          style={{ color: "var(--color-streak-gold, var(--color-accent))" }}
        >
          {t("practice.waiting")}
        </span>
      )}

      {/* Encouragement text */}
      {!isWaiting && (
        <span
          className="text-xs font-display font-semibold"
          style={{ color: "var(--color-accent)" }}
        >
          {encouragement}
        </span>
      )}

      {/* Accuracy */}
      <div className="flex items-baseline gap-1.5">
        <span
          className="text-2xl font-display font-bold tabular-nums leading-none"
          style={{ color: "var(--color-text)" }}
        >
          {Math.round(score.accuracy)}
        </span>
        <span
          className="text-sm font-display font-semibold"
          style={{ color: "var(--color-text-muted)" }}
        >
          %
        </span>
      </div>

      {/* R1-005: Early / Late / On time timing indicator */}
      {mode !== "wait" && score.lastTimingDeltaMs != null && (
        <div
          className="flex items-baseline gap-1 mt-0.5"
          key={`timing-${score.hitNotes}`}
        >
          <span
            className="text-xs font-display font-bold tabular-nums"
            style={{
              color:
                Math.abs(score.lastTimingDeltaMs) < 30
                  ? "var(--color-accent)"
                  : score.lastTimingDeltaMs < 0
                    ? "var(--color-timing-early)"
                    : "var(--color-timing-late)",
            }}
          >
            {Math.abs(score.lastTimingDeltaMs) < 30
              ? t("practice.timingOnTime")
              : score.lastTimingDeltaMs < 0
                ? `${t("practice.timingEarly")} ${Math.abs(Math.round(score.lastTimingDeltaMs))}ms`
                : `${t("practice.timingLate")} ${Math.round(score.lastTimingDeltaMs)}ms`}
          </span>
        </div>
      )}

      {/* Combo streak with pop animation */}
      {score.currentStreak > 1 && (
        <div
          className="flex items-baseline gap-1 mt-0.5 animate-combo-pop"
          key={`combo-${score.currentStreak}`}
        >
          <span
            className="text-sm font-display font-bold tabular-nums"
            style={{ color: "var(--color-combo-text)" }}
          >
            {score.currentStreak}
          </span>
          <span
            className="text-[10px] font-body"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("practice.combo")}
          </span>
        </div>
      )}
    </div>
  );
}
