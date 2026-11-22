import { Check, Flame, Star } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { DailyGoalStatus } from "../practice/nextPracticeAction";
import type { PracticeCalendar } from "./practiceCalendar";

interface HomeStatsBarProps {
  goal: DailyGoalStatus;
  calendar: PracticeCalendar;
  totalStars: number;
  maxStars: number;
  /** Opens the "this week" sheet */
  onOpenWeek: () => void;
  triggerRef?: React.Ref<HTMLButtonElement>;
}

const RING_RADIUS = 21;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Today's minutes, the streak with this week's dots, and total stars. */
export function HomeStatsBar({
  goal,
  calendar,
  totalStars,
  maxStars,
  onOpenWeek,
  triggerRef,
}: HomeStatsBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const goalReached = goal.practicedMinutes >= goal.targetMinutes;
  const dayLetters = [...t("map.weekdayShort")];
  return (
    <button
      ref={triggerRef}
      type="button"
      className="set-card hm-stats hm-stats-btn"
      data-testid="home-stats-open-week"
      aria-label={t("week.open")}
      aria-haspopup="dialog"
      onClick={onOpenWeek}
    >
      <span className="hm-stat" data-testid="home-stat-today">
        <span className="hm-ring-wrap">
          <svg className="hm-ring" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r={RING_RADIUS} className="hm-ring-track" />
            <circle
              cx="26"
              cy="26"
              r={RING_RADIUS}
              className="hm-ring-value"
              strokeDasharray={`${(goal.completionRatio * RING_LENGTH).toFixed(1)} ${RING_LENGTH.toFixed(1)}`}
              transform="rotate(-90 26 26)"
            />
          </svg>
          {goalReached && (
            <Check
              className="hm-done-mark"
              size={20}
              strokeWidth={3.5}
              role="img"
              aria-label={t("map.goalDone")}
            />
          )}
        </span>
        <span className="hm-stat-text">
          <span className="hm-k">{t("map.today")}</span>
          <span className="hm-v">
            {Math.floor(goal.practicedMinutes)}
            <small>
              {" / "}
              {goal.targetMinutes} {t("map.minutesUnit")}
            </small>
          </span>
        </span>
      </span>
      <span className="hm-stat" data-testid="home-stat-streak">
        <Flame className="hm-ico hm-flame" size={32} aria-hidden="true" />
        <span className="hm-stat-text">
          <span className="hm-k">{t("map.streak")}</span>
          <span className="hm-v">
            {calendar.streakDays}
            <small> {t("map.days")}</small>
            <span
              className="hm-week"
              role="img"
              aria-label={t("map.weekLabel")}
            >
              {calendar.week.map((on, i) => (
                <i
                  key={i}
                  className={`${on ? "is-on" : ""}${i === calendar.todayIndex ? " is-today" : ""}`}
                  title={dayLetters[i]}
                />
              ))}
            </span>
          </span>
        </span>
      </span>
      <span className="hm-stat" data-testid="home-stat-stars">
        <Star className="hm-ico hm-gold" size={32} aria-hidden="true" />
        <span className="hm-stat-text">
          <span className="hm-k">{t("map.stars")}</span>
          <span className="hm-v">
            {totalStars}
            <small> / {maxStars}</small>
          </span>
        </span>
      </span>
    </button>
  );
}
