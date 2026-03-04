import { useCallback } from "react";
import type { BuiltinSongMeta } from "../../../../shared/types";
import { useProgressStore } from "@renderer/stores/useProgressStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import {
  difficultyDescriptions,
  gradeLabelShort,
  gradeEmoji,
  gradeDescriptions,
  getGradeColor,
  getDifficultyDotColor,
} from "./songCardUtils";

interface SongCardProps {
  song: BuiltinSongMeta;
  onSelect: (songId: string) => void;
  colorIndex: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Number of difficulty dots to show (1 = beginner, 2 = intermediate, 3 = advanced) */
const difficultyDots: Record<BuiltinSongMeta["difficulty"], number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

const difficultyLabels: Record<BuiltinSongMeta["difficulty"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** Convert accuracy (0-100) to a 0-3 star count */
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
}: SongCardProps): React.JSX.Element {
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
  const gradeDesc =
    song.grade !== undefined ? gradeDescriptions[song.grade] : null;
  const gradeColor =
    song.grade !== undefined ? getGradeColor(song.grade) : null;

  return (
    <button
      onClick={handleClick}
      className="group card-hover text-left rounded-xl overflow-hidden cursor-pointer w-full"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 88%, transparent)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="h-1.5 transition-all duration-300 group-hover:h-2"
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
              className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
              style={{
                background: "var(--color-accent)",
                boxShadow:
                  "0 0 0 4px color-mix(in srgb, var(--color-accent) 18%, transparent)",
              }}
              title="Practiced"
            />
          )}
        </div>

        <div className="flex items-center justify-between mt-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex items-center gap-0.5"
              title={`${difficultyLabels[song.difficulty]}: ${difficultyDescription}`}
              aria-label={`Difficulty: ${difficultyLabels[song.difficulty]} — ${difficultyDescription}`}
            >
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="w-3 h-3 rounded-full"
                  style={{
                    background:
                      n <= dots ? dotColor : "var(--color-border)",
                  }}
                />
              ))}
            </div>

            {bestScore && (
              <div
                className="flex items-center gap-px"
                title={`Best: ${Math.round(bestScore.score.accuracy)}%`}
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

            {bestScore && (
              <span
                className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md"
                style={{
                  color: "var(--color-text-muted)",
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 80%, transparent)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {Math.round(bestScore.score.accuracy)}%
              </span>
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
