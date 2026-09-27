import { Target } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { DailyGoalStatus } from "@renderer/features/practice/nextPracticeAction";

export interface DailyGoalBannerProps {
  dailyGoalStatus: DailyGoalStatus;
}

export function DailyGoalBanner({
  dailyGoalStatus,
}: DailyGoalBannerProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background:
          "color-mix(in srgb, var(--color-note2) 8%, var(--color-surface))",
        border:
          "1px solid color-mix(in srgb, var(--color-note2) 18%, var(--color-border))",
      }}
      data-testid="library-daily-goal"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="flex items-center gap-2 text-xs font-body font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Target size={14} style={{ color: "var(--color-note2)" }} />
          {t("library.dailyGoal.label")}
        </span>
        <span
          className="text-xs font-mono tabular-nums"
          style={{ color: "var(--color-text)" }}
        >
          {t("library.dailyGoal.minutes", {
            practiced: dailyGoalStatus.practicedMinutes,
            target: dailyGoalStatus.targetMinutes,
          })}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full"
        style={{ background: "var(--color-surface-alt)" }}
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.round(dailyGoalStatus.completionRatio * 100)}%`,
            background: "var(--color-note2)",
          }}
        />
      </div>
      <p
        className="mt-1.5 text-[11px] font-body"
        style={{ color: "var(--color-text-muted)" }}
      >
        {dailyGoalStatus.isComplete
          ? t("library.dailyGoal.complete")
          : t("library.dailyGoal.remaining", {
              remaining: dailyGoalStatus.remainingMinutes,
            })}
      </p>
    </div>
  );
}
