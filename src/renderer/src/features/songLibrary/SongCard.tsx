import { useCallback, useState } from "react";
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
  onTagClick?: (tag: string) => void;
  activeTag?: string | null;
  /** Preview state: "idle" | "loading" | "playing" */
  previewState?: "idle" | "loading" | "playing";
  onPreviewClick?: (songId: string) => void;
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
  onTagClick,
  activeTag,
  previewState = "idle",
  onPreviewClick,
}: SongCardProps): React.JSX.Element {
  const [isHovered, setIsHovered] = useState(false);
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

  const handlePreviewClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPreviewClick?.(song.id);
    },
    [song.id, onPreviewClick],
  );

  const handleTagClick = useCallback(
    (e: React.MouseEvent, tag: string) => {
      e.stopPropagation();
      onTagClick?.(tag);
    },
    [onTagClick],
  );

  /** Only show non-level tags (level-N tags are not useful to display) */
  const visibleTags = song.tags.filter((t) => !t.startsWith("level-"));

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group card-hover text-left rounded-xl overflow-hidden cursor-pointer w-full"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 88%, transparent)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div
        className="h-1.5 transition-all duration-300 group-hover:h-2 relative"
        style={{
          background: `linear-gradient(95deg, ${stripeColor}, color-mix(in srgb, ${stripeColor} 38%, var(--color-surface)))`,
        }}
      >
        {/* Preview mini progress bar */}
        {previewState === "playing" && (
          <div
            className="absolute inset-0 origin-left animate-preview-progress"
            style={{
              background:
                "color-mix(in srgb, var(--color-accent) 60%, transparent)",
            }}
          />
        )}
      </div>

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

          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {/* Preview button */}
            {onPreviewClick && (
              <div
                role="button"
                tabIndex={-1}
                onClick={handlePreviewClick}
                className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150"
                style={{
                  background:
                    previewState !== "idle"
                      ? "var(--color-accent)"
                      : "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                  color:
                    previewState !== "idle" ? "#fff" : "var(--color-accent)",
                  opacity: isHovered || previewState !== "idle" ? 1 : 0,
                }}
                title={
                  previewState === "playing" ? "Stop preview" : "Preview song"
                }
              >
                {previewState === "loading" ? (
                  <div
                    className="w-3 h-3 border-[1.5px] rounded-full animate-spin"
                    style={{
                      borderColor: "transparent",
                      borderTopColor: "currentColor",
                    }}
                  />
                ) : previewState === "playing" ? (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 8 8"
                    fill="currentColor"
                  >
                    <rect x="0" y="0" width="3" height="8" rx="0.5" />
                    <rect x="5" y="0" width="3" height="8" rx="0.5" />
                  </svg>
                ) : (
                  <svg
                    width="8"
                    height="10"
                    viewBox="0 0 8 10"
                    fill="currentColor"
                  >
                    <path d="M0 0.5v9l8-4.5z" />
                  </svg>
                )}
              </div>
            )}

            {bestScore && (
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  background: "var(--color-accent)",
                  boxShadow:
                    "0 0 0 4px color-mix(in srgb, var(--color-accent) 18%, transparent)",
                }}
                title="Practiced"
              />
            )}
          </div>
        </div>

        {/* Tag chips */}
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {visibleTags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                role="button"
                tabIndex={-1}
                onClick={(e) => handleTagClick(e, tag)}
                className="text-[9px] font-body font-medium px-1.5 py-0.5 rounded-full cursor-pointer transition-colors"
                style={{
                  background:
                    activeTag === tag
                      ? "color-mix(in srgb, var(--color-accent) 25%, transparent)"
                      : "color-mix(in srgb, var(--color-accent) 10%, transparent)",
                  color:
                    activeTag === tag
                      ? "var(--color-accent)"
                      : "var(--color-text-muted)",
                  border:
                    activeTag === tag
                      ? "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)"
                      : "1px solid transparent",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Techniques — shown on hover */}
        {song.techniques && song.techniques.length > 0 && isHovered && (
          <p
            className="text-[10px] font-body mt-1.5 truncate"
            style={{ color: "var(--color-text-muted)", opacity: 0.7 }}
          >
            {song.techniques.join(" · ")}
          </p>
        )}

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
                    background: n <= dots ? dotColor : "var(--color-border)",
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
