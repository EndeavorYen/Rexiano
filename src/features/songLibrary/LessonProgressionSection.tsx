import { Target, PlayCircle } from "lucide-react";
import { songDisplayTitle } from "./songTitle";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TranslationKey } from "@renderer/i18n/types";
import type {
  LessonProgressionModel,
  LessonRecommendationReason,
} from "./lessonProgression";

const lessonRecommendationReasonKeys: Record<
  LessonRecommendationReason,
  TranslationKey
> = {
  "new-song": "library.recommendation.reason.newSong",
  "improve-score": "library.recommendation.reason.improveScore",
  "continue-progress": "library.recommendation.reason.continueProgress",
};

export interface LessonProgressionSectionProps {
  lessonProgression: LessonProgressionModel;
  loadingId: string | null;
  onSelectSong: (songId: string) => void;
  rememberReturnFocus: (testId: string) => void;
}

export function LessonProgressionSection({
  lessonProgression,
  loadingId,
  onSelectSong,
  rememberReturnFocus,
}: LessonProgressionSectionProps): React.JSX.Element {
  const { t, lang } = useTranslation();
  const nextLesson = lessonProgression.nextLesson;

  return (
    <section
      className="surface-elevated mb-5 p-4 animate-page-enter"
      data-testid="lesson-progression-panel"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target size={14} style={{ color: "var(--color-accent-text)" }} />
          <span
            className="text-xs font-body font-semibold uppercase tracking-wide"
            style={{ color: "var(--color-accent-text)" }}
          >
            {t("library.lessonPath.title")}
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)]">
        {nextLesson && (
          <button
            type="button"
            onClick={() => {
              rememberReturnFocus("lesson-progression-next");
              onSelectSong(nextLesson.song.id);
            }}
            disabled={loadingId === nextLesson.song.id}
            className="group flex min-w-0 self-start items-center gap-3 rounded-xl px-3 py-3 text-left cursor-pointer transition-all disabled:cursor-wait disabled:opacity-60"
            style={{
              background:
                "color-mix(in srgb, var(--color-note2) 10%, var(--color-surface))",
              border:
                "1px solid color-mix(in srgb, var(--color-note2) 24%, var(--color-border))",
            }}
            data-testid="lesson-progression-next"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: "var(--color-accent)",
                color: "var(--color-on-accent)",
              }}
            >
              <PlayCircle size={18} />
            </span>
            <span className="min-w-0">
              <span
                className="block text-[10px] font-body font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-accent-text)" }}
              >
                {t("library.lessonPath.next")}
              </span>
              <span
                className="block truncate text-sm font-display font-bold"
                style={{ color: "var(--color-text)" }}
              >
                {songDisplayTitle(nextLesson.song, lang).primary}
              </span>
              <span
                className="block truncate text-xs font-body"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t(lessonRecommendationReasonKeys[nextLesson.reason])}
                {" · "}
                {t("library.lessonPath.mastery", {
                  accuracy: lessonProgression.masteryAccuracy,
                })}
              </span>
            </span>
          </button>
        )}

        {/* Progress rows, not cards: they are not clickable (#307). */}
        <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {lessonProgression.groups.map((group) => {
            const progressPercent =
              group.totalSongCount > 0
                ? Math.round(
                    (group.completedSongCount / group.totalSongCount) * 100,
                  )
                : 0;

            return (
              <div
                key={group.id}
                className="px-0.5 py-1"
                data-testid={`lesson-group-${group.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  {/* Wrap instead of truncating: "Right-hand mel…" (#292) */}
                  <span
                    className="min-w-0 text-xs font-body font-semibold leading-snug"
                    style={{ color: "var(--color-text)" }}
                  >
                    {t(group.titleKey)}
                  </span>
                  <span
                    className="shrink-0 text-[10px] font-mono tabular-nums"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {t("library.lessonPath.completed", {
                      completed: group.completedSongCount,
                      total: group.totalSongCount,
                    })}
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full"
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-border) 70%, transparent)",
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPercent}%`,
                      background: group.completed
                        ? "var(--color-success-text)"
                        : "var(--color-accent)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
