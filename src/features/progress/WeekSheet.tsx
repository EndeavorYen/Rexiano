import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import {
  useSettingsStore,
  DAILY_GOAL_OPTIONS,
} from "@renderer/stores/useSettingsStore";
import { useSongLibraryStore } from "@renderer/stores/useSongLibraryStore";
import { SongCoverArt } from "../songLibrary/SongCoverArt";
import { classifySongLessonGroup } from "../songLibrary/lessonProgression";
import {
  IMPORTED_SONG_COLOR,
  lessonGroupColor,
} from "../songLibrary/lessonGroupColor";
import { StarRow } from "./StarRow";
import { WeekChart } from "./WeekChart";
import { displayMinutes, shortDate, songLabel } from "./weekFormat";
import { buildWeekReport, shiftWeek, type WeekImprovement } from "./weekReport";
import "./week-sheet.css";

/** How many weeks back the parent can look. */
export const MAX_WEEKS_BACK = 12;
const MAX_IMPROVED_ROWS = 6;

interface WeekSheetProps {
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

function ImprovedRow({ item }: { item: WeekImprovement }): React.JSX.Element {
  const { t, lang } = useTranslation();
  const color = item.song
    ? lessonGroupColor(classifySongLessonGroup(item.song))
    : IMPORTED_SONG_COLOR;
  const starsLabel = (n: number): string => t("map.starsCount", { n });
  return (
    <li className="wk-song" data-testid="week-improved-row">
      <span className="wk-cover">
        <SongCoverArt
          contour={item.song?.contour}
          seed={item.songId}
          color={color}
        />
      </span>
      <span className="wk-song-title">{songLabel(item, lang)}</span>
      <span className="wk-song-stars">
        {item.isNew ? (
          <>
            <span className="wk-chip">{t("week.newlyLearned")}</span>
            <StarRow
              stars={item.after}
              size={16}
              label={starsLabel(item.after)}
            />
          </>
        ) : (
          <>
            <StarRow
              stars={item.before}
              size={16}
              label={t("week.starsBefore", { n: item.before })}
            />
            <ArrowRight size={16} aria-hidden="true" className="wk-arrow" />
            <StarRow
              stars={item.after}
              size={16}
              label={t("week.starsNow", { n: item.after })}
            />
          </>
        )}
      </span>
    </li>
  );
}

/**
 * "This week" for the parent: minutes per day, stars gained, songs that
 * improved, and the daily goal. Opened from the home numbers row and from
 * settings. There is no yellow button here: it is a page to read, not to act.
 */
export function WeekSheet({
  onClose,
  returnFocusRef,
}: WeekSheetProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dismissRef = useRef(onClose);
  useEffect(() => {
    dismissRef.current = onClose;
  }, [onClose]);
  const dismiss = useCallback(() => dismissRef.current(), []);

  useDialogFocus({
    active: true,
    containerRef: sheetRef,
    initialFocusRef: closeRef,
    returnFocusRef,
    onDismiss: dismiss,
  });

  const sessions = useProgressStore((s) => s.sessions);
  const isLoaded = useProgressStore((s) => s.isLoaded);
  const loadSessions = useProgressStore((s) => s.loadSessions);
  const songs = useSongLibraryStore((s) => s.songs);
  const importedSongs = useSongLibraryStore((s) => s.importedSongs);
  const goalMinutes = useSettingsStore((s) => s.dailyGoalMinutes);
  const setGoal = useSettingsStore((s) => s.setDailyGoalMinutes);
  const [now] = useState(() => Date.now());
  const [weeksBack, setWeeksBack] = useState(0);

  useEffect(() => {
    if (!isLoaded) void loadSessions();
  }, [isLoaded, loadSessions]);

  const report = useMemo(
    () =>
      buildWeekReport(sessions, songs, importedSongs, {
        weekStart: shiftWeek(now, -weeksBack),
        now,
        goalMinutes,
      }),
    [sessions, songs, importedSongs, now, weeksBack, goalMinutes],
  );

  const first = report.days[0].date;
  const last = report.days[6].date;
  const range = `${shortDate(first)} – ${shortDate(last)}`;
  const title = weeksBack === 0 ? t("week.title") : t("week.otherWeek");
  const shownImproved = report.improved.slice(0, MAX_IMPROVED_ROWS);
  const hiddenImproved = report.improved.length - shownImproved.length;
  const canGoBack = weeksBack < MAX_WEEKS_BACK;
  const canGoForward = weeksBack > 0;

  return (
    <div
      className="family-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="family-sheet wk-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("week.title")}
        tabIndex={-1}
        data-testid="week-sheet"
      >
        <div className="family-sheet-head">
          <div className="wk-head-text">
            <h2 data-testid="week-title">{title}</h2>
            <span className="wk-range" data-testid="week-range">
              {range}
            </span>
          </div>
          <button
            className="icon-btn"
            aria-label={t("week.prev")}
            title={t("week.prev")}
            aria-disabled={!canGoBack}
            onClick={() => canGoBack && setWeeksBack((n) => n + 1)}
            data-testid="week-prev"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="icon-btn"
            aria-label={t("week.next")}
            title={t("week.next")}
            aria-disabled={!canGoForward}
            onClick={() => canGoForward && setWeeksBack((n) => n - 1)}
            data-testid="week-next"
          >
            <ChevronRight size={20} />
          </button>
          <button
            ref={closeRef}
            className="icon-btn"
            onClick={onClose}
            aria-label={t("settings.close")}
            title={t("settings.close")}
            data-testid="week-close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="family-sheet-body" tabIndex={0}>
          <section className="set-card wk-stats" data-testid="week-stats">
            <div className="wk-stat" data-testid="week-stat-minutes">
              <span className="wk-k">{t("week.statMinutes")}</span>
              <span className="wk-v">
                {report.totalMinutes}
                <small> {t("map.minutesUnit")}</small>
              </span>
            </div>
            <div className="wk-stat" data-testid="week-stat-days">
              <span className="wk-k">{t("week.statDays")}</span>
              <span className="wk-v">
                {report.daysPracticed}
                <small> / 7</small>
              </span>
            </div>
            <div className="wk-stat" data-testid="week-stat-stars">
              <span className="wk-k">{t("week.statStars")}</span>
              <span className="wk-v">{report.starsEarned}</span>
            </div>
          </section>

          <section className="set-card">
            <h3>{t("week.chartTitle")}</h3>
            <WeekChart days={report.days} goalMinutes={goalMinutes} />
          </section>

          <section className="set-card" data-testid="week-improved">
            <h3>{t("week.improvedTitle")}</h3>
            {shownImproved.length === 0 ? (
              <p className="hint" data-testid="week-improved-empty">
                {t("week.improvedNone")}
              </p>
            ) : (
              <ul className="wk-songs">
                {shownImproved.map((item) => (
                  <ImprovedRow key={item.songId} item={item} />
                ))}
              </ul>
            )}
            {hiddenImproved > 0 && (
              <p className="hint">
                {t("week.moreSongs", { n: hiddenImproved })}
              </p>
            )}
            {report.topSong && (
              <p className="wk-top" data-testid="week-top-song">
                <span className="wk-top-k">{t("week.topTitle")}</span>
                <span>
                  {t("week.topValue", {
                    title: songLabel(report.topSong, lang),
                    minutes: displayMinutes(report.topSong.minutes),
                  })}
                </span>
              </p>
            )}
          </section>

          <section className="set-card" data-testid="week-goal">
            <h3>{t("week.goalTitle")}</h3>
            <div
              className="segmented"
              role="group"
              aria-label={t("week.goalTitle")}
            >
              {DAILY_GOAL_OPTIONS.map((option) => (
                <button
                  key={option}
                  aria-pressed={goalMinutes === option}
                  onClick={() => setGoal(option)}
                  data-testid={`week-goal-${option}`}
                >
                  {t("week.goalOption", { n: option })}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
