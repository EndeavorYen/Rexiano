import { useMemo, useState } from "react";
import {
  useSongStore,
  type SegmentDifficulty,
} from "@renderer/stores/useSongStore";
import { useTranslation } from "@renderer/i18n/useTranslation";

/**
 * Map a 0-1 difficulty score to a color string.
 * Uses fixed semantic colors (green/yellow/orange/red) that work across all themes.
 */
function difficultyColor(d: number): string {
  if (d < 0.3) return "#4ade80"; // green — easy
  if (d < 0.6) return "#facc15"; // yellow — medium
  if (d < 0.8) return "#fb923c"; // orange — hard
  return "#ef4444"; // red — very hard
}

/**
 * Get a human-readable difficulty label translation key.
 */
function difficultyLabelKey(
  d: number,
): "heatmap.easy" | "heatmap.medium" | "heatmap.hard" | "heatmap.veryHard" {
  if (d < 0.3) return "heatmap.easy";
  if (d < 0.6) return "heatmap.medium";
  if (d < 0.8) return "heatmap.hard";
  return "heatmap.veryHard";
}

/**
 * A thin horizontal heatmap bar showing per-segment difficulty across a song.
 * Rendered below the seek bar in TransportBar.
 *
 * Each segment is a colored rectangle proportional to its time span.
 * Hovering a segment shows a tooltip with the difficulty level.
 *
 * Only renders when a song is loaded. Uses fixed semantic colors
 * (green/yellow/orange/red) for universal readability across themes.
 */
export function DifficultyHeatmap(): React.JSX.Element | null {
  const { t } = useTranslation();
  const song = useSongStore((s) => s.song);
  const getSegmentDifficulties = useSongStore((s) => s.getSegmentDifficulties);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const segments: SegmentDifficulty[] = useMemo(() => {
    if (!song) return [];
    return getSegmentDifficulties(2);
  }, [song, getSegmentDifficulties]);

  if (!song || segments.length === 0 || song.duration <= 0) return null;

  const duration = song.duration;

  return (
    <div
      className="relative flex w-full rounded-md overflow-hidden"
      style={{
        height: 10,
        background: "var(--color-surface-alt)",
        border: "1px solid var(--color-border)",
      }}
      role="img"
      aria-label={t("heatmap.ariaLabel")}
      data-testid="difficulty-heatmap"
    >
      {segments.map((seg, i) => {
        const widthPercent = ((seg.endTime - seg.startTime) / duration) * 100;
        const isHovered = hoveredIndex === i;

        return (
          <div
            key={i}
            className="relative"
            style={{
              width: `${widthPercent}%`,
              height: "100%",
              background: difficultyColor(seg.difficulty),
              opacity: isHovered ? 1 : 0.7,
              transition: "opacity 0.15s ease",
              cursor: "default",
            }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {isHovered && (
              <div
                className="absolute z-50 rounded-md px-2 py-1 text-[10px] font-body whitespace-nowrap pointer-events-none"
                style={{
                  bottom: "calc(100% + 4px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                  boxShadow:
                    "0 2px 8px color-mix(in srgb, var(--color-text) 12%, transparent)",
                }}
              >
                {t(difficultyLabelKey(seg.difficulty))} (
                {Math.round(seg.difficulty * 100)}%)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
