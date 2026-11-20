import "./songbook.css";
import { SongCoverArt } from "./SongCoverArt";
import { StarRow } from "../progress/StarRow";
import type { StarCount } from "../progress/stars";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { formatShelfDuration } from "./songShelves";

export interface SongCoverCardProps {
  /** Name shown on the label, already in the UI language */
  title: string;
  /** Length in seconds; imported songs have none until they are opened */
  durationSeconds: number | null;
  /** Small text after the length, e.g. "等級 2" */
  levelLabel: string | null;
  /** Replaces the length line (imported songs that cannot be found) */
  noteOverride?: string;
  stars: StarCount;
  /** Cover background, a CSS color or var() */
  color: string;
  contour: readonly number[] | undefined;
  seed: string;
  testId: string;
  isLoading?: boolean;
  onSelect: (viaKeyboard: boolean) => void;
}

/**
 * One song as a book cover: 3:4, the melody's own opening as the picture,
 * a white name label and a star badge. Always a real button.
 */
export function SongCoverCard({
  title,
  durationSeconds,
  levelLabel,
  noteOverride,
  stars,
  color,
  contour,
  seed,
  testId,
  isLoading = false,
  onSelect,
}: SongCoverCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const duration =
    durationSeconds === null ? null : formatShelfDuration(durationSeconds, t);
  const starsLabel = t("songbook.stars.label", { stars });
  const meta =
    noteOverride ?? [duration, levelLabel].filter(Boolean).join(" · ");
  const ariaLabel = [
    title,
    noteOverride ?? duration,
    levelLabel,
    stars > 0 ? starsLabel : null,
  ]
    .filter(Boolean)
    .join("，");

  return (
    <button
      type="button"
      className="cover-card"
      style={{ "--c": color } as React.CSSProperties}
      data-testid={testId}
      data-stars={stars}
      aria-label={ariaLabel}
      aria-busy={isLoading || undefined}
      onClick={(event) => onSelect(event.detail === 0)}
    >
      <SongCoverArt
        className="art"
        contour={contour}
        seed={seed}
        color={color}
      />
      {stars > 0 && (
        <span className="badge">
          <StarRow stars={stars} size={14} label={starsLabel} />
        </span>
      )}
      <span className="label">
        <span className="t">{title}</span>
        {meta && <span className="m">{meta}</span>}
      </span>
      {isLoading && (
        <span className="cover-loading" aria-hidden="true">
          <span className="cover-spinner" />
        </span>
      )}
    </button>
  );
}

/** Grey placeholder shown while the catalogue loads. */
export function SongCoverSkeleton(): React.JSX.Element {
  return (
    <div className="cover-card cover-skeleton skeleton" aria-hidden="true" />
  );
}
