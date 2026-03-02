import type { PracticeScore } from "@shared/types";
import { useTranslation } from "@renderer/i18n/useTranslation";

interface StatisticsPageProps {
  score: PracticeScore;
  songName: string;
  onPlayAgain: () => void;
  onChooseSong: () => void;
}

/**
 * Post-session statistics overlay shown after CelebrationOverlay dismissal.
 * Displays accuracy, note breakdown, and streak summary.
 */
export function StatisticsPage({
  score,
  songName,
  onPlayAgain,
  onChooseSong,
}: StatisticsPageProps): React.JSX.Element {
  const { t } = useTranslation();

  const accuracyColor =
    score.accuracy >= 90
      ? "var(--color-accent)"
      : score.accuracy >= 60
        ? "#f59e0b"
        : "#ef4444";
  const ringDegrees =
    score.totalNotes === 0
      ? 0
      : Math.max(0, Math.min(360, (score.accuracy / 100) * 360));

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center modal-backdrop-cinematic">
      <div
        className="w-[92vw] max-w-[500px] rounded-2xl shadow-2xl modal-card-cinematic p-6 sm:p-7"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 90%, transparent)",
          border: "1px solid var(--color-border)",
        }}
        data-testid="statistics-page"
      >
        {/* Song name */}
        <div className="flex justify-center mb-1">
          <span className="kicker-label">{t("app.subtitle")}</span>
        </div>
        <p
          className="text-xs font-body text-center mb-1 truncate"
          style={{ color: "var(--color-text-muted)" }}
        >
          {songName}
        </p>

        {/* Title */}
        <h2
          className="text-lg font-display font-bold text-center mb-5"
          style={{ color: "var(--color-text)" }}
        >
          {t("stats.title")}
        </h2>

        {/* Accuracy big number */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-36 h-36 rounded-full flex items-center justify-center mb-2"
            style={{
              background: `conic-gradient(${accuracyColor} ${ringDegrees}deg, color-mix(in srgb, var(--color-surface-alt) 90%, var(--color-surface)) ${ringDegrees}deg)`,
              border: `1px solid color-mix(in srgb, ${accuracyColor} 28%, var(--color-border))`,
              boxShadow: `inset 0 0 0 8px color-mix(in srgb, ${accuracyColor} 12%, transparent)`,
            }}
          >
            <span
              className="text-5xl font-display font-bold tabular-nums"
              style={{ color: accuracyColor }}
            >
              {score.totalNotes === 0 ? "—" : `${Math.round(score.accuracy)}%`}
            </span>
          </div>
          <span
            className="text-xs font-body mt-1 uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("stats.accuracy")}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <StatCell
            value={score.hitNotes}
            label={t("stats.notesHit")}
            color="var(--color-accent)"
          />
          <StatCell
            value={score.missedNotes}
            label={t("stats.notesMissed")}
            color="#ef4444"
          />
          <StatCell
            value={score.bestStreak}
            label={t("stats.streak")}
            color="#f59e0b"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onPlayAgain}
            className="flex-1 py-2.5 rounded-xl text-sm font-body font-medium cursor-pointer btn-primary-themed"
            data-testid="stats-play-again"
          >
            {t("stats.playAgain")}
          </button>
          <button
            onClick={onChooseSong}
            className="flex-1 py-2.5 rounded-xl text-sm font-body font-medium cursor-pointer btn-surface-themed"
            data-testid="stats-choose-song"
          >
            {t("stats.backToLibrary")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCell({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center py-3 rounded-xl"
      style={{
        background:
          "color-mix(in srgb, var(--color-surface-alt) 74%, var(--color-surface))",
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        className="text-2xl font-display font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
      <span
        className="text-[10px] font-body mt-0.5 text-center"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
    </div>
  );
}
