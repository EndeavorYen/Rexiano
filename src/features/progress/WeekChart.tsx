import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { WeekDay } from "./weekReport";
import { displayMinutes, songLabel } from "./weekFormat";

/** Height of the bar area (above the weekday labels) and of the label row. */
const PLOT_HEIGHT = 136;
const LABEL_HEIGHT = 24;
/** Room above the tallest bar for its value and the goal check. */
const HEADROOM = 36;
const BAR_SPACE = PLOT_HEIGHT - HEADROOM;
const MAX_TIP_SONGS = 3;

interface WeekChartProps {
  days: readonly WeekDay[];
  goalMinutes: number;
}

function longDate(date: string, lang: string): string {
  return new Intl.DateTimeFormat(lang, {
    timeZone: "UTC",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Minutes practised on each day of one week. One series, one hue: the bar
 * color is `--color-note1`; yellow stays on buttons and green/red on right/
 * wrong. The daily goal is the only reference line, a dashed one, and a day
 * that reached it carries a check so nothing depends on color.
 */
export function WeekChart({
  days,
  goalMinutes,
}: WeekChartProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const [active, setActive] = useState<number | null>(null);
  const letters = [...t("map.weekdayShort")];
  const scaleMax = Math.max(goalMinutes, ...days.map((d) => d.minutes), 1);
  const goalBottom = LABEL_HEIGHT + (goalMinutes / scaleMax) * BAR_SPACE;

  return (
    <figure
      className="wk-chart"
      style={{ height: PLOT_HEIGHT + LABEL_HEIGHT }}
      data-testid="week-chart"
    >
      <div className="wk-baseline" style={{ bottom: LABEL_HEIGHT }} />
      <div className="wk-goal" style={{ bottom: goalBottom }}>
        <span className="wk-goal-label">
          {t("week.goalLine", { n: goalMinutes })}
        </span>
      </div>
      <div className="wk-cols">
        {days.map((day, index) => {
          const shown = displayMinutes(day.minutes);
          const barHeight =
            day.minutes > 0
              ? Math.max(4, (day.minutes / scaleMax) * BAR_SPACE)
              : 2;
          const songsText = day.songs
            .map((song) => songLabel(song, lang))
            .join("、");
          const label = [
            t("week.barLabel", {
              day: longDate(day.date, lang),
              minutes: shown,
            }),
            day.goalMet ? t("week.goalHit") : null,
            songsText || null,
          ]
            .filter(Boolean)
            .join("。");
          const edge = index <= 1 ? "start" : index >= 5 ? "end" : "mid";
          return (
            <div
              key={day.date}
              className={`wk-col${day.isToday ? " is-today" : ""}${day.isFuture ? " is-future" : ""}`}
              tabIndex={0}
              role="img"
              aria-label={label}
              data-testid="week-bar"
              data-date={day.date}
              data-minutes={day.minutes.toFixed(2)}
              data-goal-met={day.goalMet ? "true" : "false"}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              {day.goalMet && (
                <Check
                  className="wk-check"
                  size={14}
                  strokeWidth={3.5}
                  aria-hidden="true"
                  data-testid="week-bar-goal-check"
                />
              )}
              {shown > 0 && <span className="wk-value">{shown}</span>}
              <span
                className={`wk-bar${day.minutes > 0 ? "" : " is-zero"}`}
                style={{ height: barHeight }}
              />
              <span className="wk-day">{letters[index]}</span>
              {active === index && (
                <span
                  className="wk-tip"
                  data-edge={edge}
                  aria-hidden="true"
                  data-testid="week-tip"
                >
                  <b>{longDate(day.date, lang)}</b>
                  <span>
                    {day.minutes > 0
                      ? t("week.minutesValue", { n: shown })
                      : t("week.noPractice")}
                  </span>
                  {day.songs.slice(0, MAX_TIP_SONGS).map((song) => (
                    <span key={song.songId} className="wk-tip-song">
                      {songLabel(song, lang)}
                    </span>
                  ))}
                  {day.songs.length > MAX_TIP_SONGS && (
                    <span className="wk-tip-song">
                      {t("week.moreSongs", {
                        n: day.songs.length - MAX_TIP_SONGS,
                      })}
                    </span>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <table className="wk-sr" data-testid="week-chart-table">
        <caption>{t("week.chartTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("week.tableDate")}</th>
            <th scope="col">{t("week.tableMinutes")}</th>
            <th scope="col">{t("week.tableSongs")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{longDate(day.date, lang)}</th>
              <td>{displayMinutes(day.minutes)}</td>
              <td>
                {day.songs.map((song) => songLabel(song, lang)).join("、") ||
                  t("week.noPractice")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
