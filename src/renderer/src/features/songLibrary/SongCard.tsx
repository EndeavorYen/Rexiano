import { useCallback } from "react";
import type { BuiltinSongMeta } from "../../../../shared/types";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import {
  difficultyDescriptions,
  gradeLabelShort,
  gradeEmoji,
  gradeDescriptionKeys,
  getGradeColor,
  getDifficultyDotColor,
} from "./songCardUtils";
import type { TranslationKey } from "@renderer/i18n/types";

interface SongCardProps {
  song: BuiltinSongMeta;
  onSelect: (songId: string) => void;
  colorIndex: number;
  /** When true, the card button is disabled (e.g. another song is loading) */
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const difficultyDots: Record<BuiltinSongMeta["difficulty"], number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const difficultyLabelKeys: Record<
  BuiltinSongMeta["difficulty"],
  | "library.difficulty.beginner"
  | "library.difficulty.intermediate"
  | "library.difficulty.advanced"
> = {
  beginner: "library.difficulty.beginner",
  intermediate: "library.difficulty.intermediate",
  advanced: "library.difficulty.advanced",
};

function accuracyToStars(accuracy: number): number {
  if (accuracy >= 90) return 3;
  if (accuracy >= 70) return 2;
  if (accuracy >= 40) return 1;
  return 0;
}

export function SongCard({
  song,
  onSelect,
  colorIndex,
  disabled = false,
}: SongCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const noteColors = [
    "var(--color-note1)",
    "var(--color-note2)",
    "var(--color-note3)",
    "var(--color-note4)",
  ];
  const stripeColor = noteColors[colorIndex % noteColors.length];
  const bestScore = useProgressStore((s) => s.getBestScore(song.id));
  const language = useSettingsStore((s) => s.language);

  const displayTitle =
    language === "zh-TW" ? (song.titleZh ?? song.title) : song.title;
  const displayComposer =
    language === "zh-TW" ? (song.composerZh ?? song.composer) : song.composer;

  const handleClick = useCallback(() => {
    onSelect(song.id);
  }, [song.id, onSelect]);

  const difficultyDescription = difficultyDescriptions[song.difficulty];
  const dots = difficultyDots[song.difficulty];
  const stars = bestScore ? accuracyToStars(bestScore.score.accuracy) : 0;
  const dotColor = getDifficultyDotColor(song.grade);
  const gradeLabel =
    song.grade !== undefined
      ? `${gradeEmoji[song.grade] ?? ""} ${gradeLabelShort[song.grade]}`
      : null;
  const gradeDescKey =
    song.grade !== undefined ? gradeDescriptionKeys[song.grade] : null;
  const gradeDesc = gradeDescKey
    ? t(gradeDescKey as TranslationKey)
    : null;
  const gradeColor =
    song.grade !== undefined ? getGradeColor(song.grade) : null;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-label={displayTitle}
      className="group card-hover text-left rounded-xl overflow-hidden cursor-pointer w-full disabled:opacity-50 disabled:cursor-wait disabled:pointer-events-none"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 88%, transparent)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="h-1.5 transition-[height] duration-300 group-hover:h-2"
        style={{
          background: `linear-gradient(95deg, ${stripeColor}, color-mix(in srgb, ${stripeColor} 38%, var(--color-surface)))`,
        }}
      />

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <h3
              className="font-body font-semibold text-sm truncate"
              style={{ color: "var(--color-text)" }}
            >
              {displayTitle}
            </h3>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: "var(--color-text-muted)" }}
            >
              {displayComposer}
            </p>
          </div>

          {bestScore && (
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5"
              style={{
                background: "var(--color-accent)",
                boxShadow:
                  "0 0 0 4px color-mix(in srgb, var(--color-accent) 18%, transparent)",
              }}
              title={t("songCard.practiced")}
              role="img"
              aria-label={t("songCard.practiced")}
            />
          )}
        </div>

        <div className="flex items-center justify-between mt-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex items-center gap-0.5"
              title={`${t(difficultyLabelKeys[song.difficulty])}: ${difficultyDescription}`}
              aria-label={t("songCard.difficulty", {
                level: t(difficultyLabelKeys[song.difficulty]),
                desc: difficultyDescription,
              })}
            >
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="w-3 h-3 rounded-full"
                  style={{
                    background: n <= dots ? dotColor : "var(--color-border)",
                  }}
                />
              ))}
            </div>

            {bestScore && (
              <div
                className="flex items-center gap-px"
                title={t("songCard.bestScore", {
                  score: Math.round(bestScore.score.accuracy),
                })}
              >
                {[1, 2, 3].map((n) => (
                  <svg
                    key={n}
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill={n <= stars ? "var(--color-streak-gold)" : "none"}
                    stroke={
                      n <= stars
                        ? "var(--color-streak-gold)"
                        : "var(--color-border)"
                    }
                    strokeWidth="1.2"
                  >
                    <path d="M6 1l1.5 3.1L11 4.5 8.5 7l.6 3.5L6 8.8 2.9 10.5l.6-3.5L1 4.5l3.5-.4L6 1z" />
                  </svg>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {gradeLabel && gradeColor && (
              <span
                className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md"
                style={{
                  color: gradeColor,
                  background: `color-mix(in srgb, ${gradeColor} 12%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${gradeColor} 30%, transparent)`,
                }}
                title={gradeDesc ?? undefined}
              >
                {gradeLabel}
              </span>
            )}
            <span
              className="text-[11px] font-mono tabular-nums"
              style={{ color: "var(--color-text-muted)" }}
            >
              {formatDuration(song.durationSeconds)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
