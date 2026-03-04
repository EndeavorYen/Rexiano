/**
 * Circular progress ring showing daily practice minutes vs goal.
 * Positioned as a small, non-intrusive element.
 */
import { useProgressStore } from "@renderer/stores/useProgressStore";
import { useTranslation } from "@renderer/i18n/useTranslation";

/** SVG ring dimensions */
const RING_SIZE = 52;
const STROKE_WIDTH = 4;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DailyGoal(): React.JSX.Element {
  const { t } = useTranslation();
  const goalMinutes = useProgressStore((s) => s.dailyGoalMinutes);
  const todayMs = useProgressStore((s) => s.todayPracticeMs);

  const practicedMinutes = Math.floor(todayMs / 60_000);
  const progress = Math.min(practicedMinutes / goalMinutes, 1);
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const goalReached = practicedMinutes >= goalMinutes;

  return (
    <div
      className="flex items-center gap-2"
      title={t("progress.dailyGoal")}
      data-testid="daily-goal"
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="shrink-0"
      >
        {/* Background track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={STROKE_WIDTH}
        />
        {/* Progress arc */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={
            goalReached ? "var(--color-streak-gold)" : "var(--color-accent)"
          }
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          style={{
            transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease",
          }}
        />
        {/* Center text */}
        <text
          x={RING_SIZE / 2}
          y={RING_SIZE / 2 - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-mono font-bold"
          style={{
            fill: goalReached
              ? "var(--color-streak-gold)"
              : "var(--color-text)",
            fontSize: "11px",
          }}
        >
          {practicedMinutes}
        </text>
        <text
          x={RING_SIZE / 2}
          y={RING_SIZE / 2 + 8}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-body"
          style={{
            fill: "var(--color-text-muted)",
            fontSize: "7px",
          }}
        >
          / {goalMinutes} {t("progress.min")}
        </text>
      </svg>
    </div>
  );
}
