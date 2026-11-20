import "./songbook.css";
import { Star } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { lessonGroupColor } from "./lessonGroupColor";
import type { StarsSummary } from "./starsSummary";

export interface StarsSummaryCardProps {
  summary: StarsSummary;
  /** `wide`: one slim row of units (under 120px tall) */
  layout?: "side" | "wide";
  /** Sits on its own between the search bar and the shelves */
  standalone?: boolean;
}

/** "My stars": the total, and one thin progress line per lesson unit. Not clickable. */
export function StarsSummaryCard({
  summary,
  layout = "side",
  standalone = false,
}: StarsSummaryCardProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <section
      className={`set-card stars-summary is-${layout}${standalone ? " is-standalone" : ""}`}
      aria-label={t("songbook.summary.title")}
      data-testid="songbook-stars-summary"
    >
      <div
        className="stars-summary-head"
        role="img"
        aria-label={t("songbook.summary.aria", {
          earned: summary.earned,
          max: summary.max,
        })}
      >
        <h3 className="stars-summary-title">
          <Star size={18} aria-hidden="true" />
          {t("songbook.summary.title")}
        </h3>
        <span className="stars-summary-total" aria-hidden="true">
          <b>{summary.earned}</b>／{summary.max}
        </span>
      </div>
      <ul className="stars-summary-units">
        {summary.units.map((unit) => (
          <li
            key={unit.groupId}
            style={
              { "--c": lessonGroupColor(unit.groupId) } as React.CSSProperties
            }
          >
            <span className="stars-summary-name">{t(unit.titleKey)}</span>
            <span className="stars-summary-count">
              {unit.done}/{unit.total}
            </span>
            <span className="stars-summary-bar" aria-hidden="true">
              <span
                style={{
                  width: `${unit.total > 0 ? (unit.done / unit.total) * 100 : 0}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
