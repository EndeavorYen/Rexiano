import type { PracticeMode, PracticeScore } from "@shared/types";
import { useTranslation } from "@renderer/i18n/useTranslation";

interface StatisticsPageProps {
  score: PracticeScore;
  songName: string;
  mode: PracticeMode;
  speed: number;
  durationSeconds: number;
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
  mode,
  speed,
  durationSeconds,
  onPlayAgain,
  onChooseSong,
}: StatisticsPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const totalNotes = score.totalNotes;
  const hitRate = totalNotes > 0 ? (score.hitNotes / totalNotes) * 100 : 0;
  const missRate = totalNotes > 0 ? (score.missedNotes / totalNotes) * 100 : 0;
  const consistency = totalNotes > 0 ? (score.bestStreak / totalNotes) * 100 : 0;

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
  const reward = getRewardTier(score.accuracy);
  const tips = getPracticeTips(score, mode, speed);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center modal-backdrop-cinematic">
      <div
        className="w-[92vw] max-w-[560px] max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl modal-card-cinematic p-6 sm:p-7"
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

        {/* Accuracy + reward */}
        <div className="flex flex-col items-center mb-5">
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
        <div
          className="mb-6 rounded-xl px-4 py-3 text-center"
          style={{
            background:
              "color-mix(in srgb, var(--color-surface-alt) 80%, var(--color-surface))",
            border:
              "1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border))",
          }}
        >
          <div
            className="text-[10px] font-mono uppercase tracking-wider"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("stats.reward")}
          </div>
          <div
            className="mt-1 text-base font-display font-bold"
            style={{ color: "var(--color-accent)" }}
          >
            {t(reward)}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
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
          <StatCell
            value={score.totalNotes}
            label={t("stats.totalNotes")}
            color="var(--color-text)"
          />
          <StatCell
            value={Number(hitRate.toFixed(1))}
            suffix="%"
            label={t("stats.hitRate")}
            color="var(--color-accent)"
          />
          <StatCell
            value={Number(consistency.toFixed(1))}
            suffix="%"
            label={t("stats.consistency")}
            color="#3b82f6"
          />
        </div>

        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <ContextCell
            label={t("stats.mode")}
            value={t(modeKey(mode))}
          />
          <ContextCell
            label={t("stats.speed")}
            value={`${speed.toFixed(2)}x`}
          />
          <ContextCell
            label={t("stats.duration")}
            value={formatDuration(durationSeconds)}
          />
        </div>

        <div
          className="rounded-xl px-4 py-3 mb-6"
          style={{
            background:
              "color-mix(in srgb, var(--color-surface-alt) 76%, var(--color-surface))",
            border: "1px solid var(--color-border)",
          }}
        >
          <p
            className="text-[11px] font-display font-bold uppercase tracking-wider mb-2"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("stats.nextFocus")}
          </p>
          <div className="flex flex-col gap-1.5">
            {tips.map((tipKey) => (
              <p
                key={tipKey}
                className="text-xs font-body"
                style={{ color: "var(--color-text)" }}
              >
                · {t(tipKey)}
              </p>
            ))}
            {totalNotes > 0 && (
              <p
                className="text-[11px] font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("stats.missRateSummary", {
                  miss: missRate.toFixed(1),
                  hit: hitRate.toFixed(1),
                })}
              </p>
            )}
          </div>
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
  suffix,
  label,
  color,
}: {
  value: number;
  suffix?: string;
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
        {suffix ?? ""}
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

function ContextCell({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center py-2.5 rounded-lg"
      style={{
        background:
          "color-mix(in srgb, var(--color-surface-alt) 70%, var(--color-surface))",
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        className="text-[10px] font-mono uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-xs font-display font-bold mt-1 tabular-nums"
        style={{ color: "var(--color-text)" }}
      >
        {value}
      </span>
    </div>
  );
}

function getRewardTier(accuracy: number):
  | "stats.rewardLegend"
  | "stats.rewardGold"
  | "stats.rewardSilver"
  | "stats.rewardBronze" {
  if (accuracy >= 95) return "stats.rewardLegend";
  if (accuracy >= 85) return "stats.rewardGold";
  if (accuracy >= 70) return "stats.rewardSilver";
  return "stats.rewardBronze";
}

function modeKey(
  mode: PracticeMode,
): "stats.modeWait" | "stats.modeFree" | "stats.modeWatch" {
  if (mode === "wait") return "stats.modeWait";
  if (mode === "free") return "stats.modeFree";
  return "stats.modeWatch";
}

function getPracticeTips(
  score: PracticeScore,
  mode: PracticeMode,
  speed: number,
): Array<
  | "stats.tipSlowDown"
  | "stats.tipUseWaitMode"
  | "stats.tipTrainStreak"
  | "stats.tipRaiseSpeed"
  | "stats.tipKeepGoing"
> {
  const tips: Array<
    | "stats.tipSlowDown"
    | "stats.tipUseWaitMode"
    | "stats.tipTrainStreak"
    | "stats.tipRaiseSpeed"
    | "stats.tipKeepGoing"
  > = [];

  if (score.accuracy < 75) {
    tips.push("stats.tipSlowDown");
  }
  if (mode !== "wait" && score.missedNotes > score.hitNotes / 2) {
    tips.push("stats.tipUseWaitMode");
  }
  if (score.bestStreak < 8 && score.totalNotes > 0) {
    tips.push("stats.tipTrainStreak");
  }
  if (score.accuracy >= 90 && speed < 1.2) {
    tips.push("stats.tipRaiseSpeed");
  }
  if (tips.length === 0) {
    tips.push("stats.tipKeepGoing");
  }
  return tips.slice(0, 3);
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}
