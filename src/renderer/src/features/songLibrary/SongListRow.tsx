import { Star } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { categoryLabelKeys, formatSongDuration } from "./songCardUtils";
import type { SongActivity } from "./songLibrarySelectors";
import type { BuiltinSongMeta } from "@shared/types";

export function LoadingOverlay({
  radiusClass,
}: {
  radiusClass: string;
}): React.JSX.Element {
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center ${radiusClass}`}
      style={{
        background: "color-mix(in srgb, var(--color-surface) 70%, transparent)",
      }}
    >
      <div
        className="w-5 h-5 border-2 rounded-full animate-spin"
        style={{
          borderColor: "var(--color-border)",
          borderTopColor: "var(--color-accent)",
        }}
      />
    </div>
  );
}

export function FavoriteButton({
  song,
  activity,
  onToggleFavorite,
  className = "",
}: {
  song: BuiltinSongMeta;
  activity: SongActivity;
  onToggleFavorite: (songId: string) => void;
  className?: string;
}): React.JSX.Element {
  const { t } = useTranslation();
  const label = activity.isFavorite
    ? t("library.unfavorite")
    : t("library.favorite");

  return (
    <button
      type="button"
      data-testid="song-favorite-toggle"
      onClick={() => onToggleFavorite(song.id)}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors cursor-pointer ${className}`}
      aria-label={`${label}: ${song.title}`}
      aria-pressed={activity.isFavorite}
      title={`${label}: ${song.title}`}
      style={{
        background: activity.isFavorite
          ? "color-mix(in srgb, var(--color-streak-gold) 18%, var(--color-surface))"
          : "color-mix(in srgb, var(--color-surface) 90%, transparent)",
        color: activity.isFavorite
          ? "var(--color-streak-gold)"
          : "var(--color-text-muted)",
        border: "1px solid var(--color-border)",
      }}
    >
      <Star size={15} fill={activity.isFavorite ? "currentColor" : "none"} />
    </button>
  );
}

export function StatBadge({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}): React.JSX.Element {
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 75%, transparent)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span style={{ color: "var(--color-accent)" }}>{icon}</span>
      <div className="min-w-0">
        <span
          className="text-sm font-display font-bold leading-tight block"
          style={{ color: "var(--color-text)" }}
        >
          {value}
        </span>
        <span
          className="text-[10px] font-body leading-tight truncate block"
          style={{ color: "var(--color-text-muted)" }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

export interface SongListRowProps {
  song: BuiltinSongMeta;
  activity: SongActivity;
  isLoading: boolean;
  isSelected: boolean;
  onSelect: (songId: string, viaKeyboard: boolean) => void;
  onToggleFavorite?: (songId: string) => void;
  animationDelay: number;
}

export function SongListRow({
  song,
  activity,
  isLoading,
  isSelected,
  onSelect,
  animationDelay,
}: SongListRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const category = song.category ?? "popular";
  const practicedLabel =
    activity.playCount > 0
      ? t("library.practicedTimes", { count: activity.playCount })
      : t("library.neverPracticed");

  return (
    <div
      className="relative flex items-stretch gap-2 rounded-lg animate-stagger-child"
      style={{
        background: isSelected
          ? "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))"
          : "color-mix(in srgb, var(--color-surface) 88%, transparent)",
        border: isSelected
          ? "1px solid color-mix(in srgb, var(--color-accent) 32%, var(--color-border))"
          : "1px solid var(--color-border)",
        animationDelay: `${animationDelay}ms`,
      }}
    >
      <button
        data-testid={`song-select-${song.id}`}
        onClick={(event) => onSelect(song.id, event.detail === 0)}
        disabled={isLoading}
        className="grid min-w-0 flex-1 grid-cols-1 items-center gap-2 px-3 py-2.5 text-left cursor-pointer disabled:cursor-wait disabled:opacity-60 md:grid-cols-[minmax(0,1.5fr)_auto_auto_auto]"
      >
        <span className="min-w-0">
          <h3
            className="truncate text-sm font-body font-semibold"
            data-testid="song-list-row-title"
            style={{ color: "var(--color-text)" }}
          >
            {song.title}
          </h3>
          <span
            className="mt-0.5 block truncate text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {song.composer}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5 md:justify-end">
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-body font-medium"
            style={{
              color: "var(--color-text-muted)",
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
            }}
          >
            {t(categoryLabelKeys[category])}
          </span>
        </span>

        <span
          className="flex items-center gap-2 text-[11px] font-mono tabular-nums md:justify-end"
          style={{ color: "var(--color-text-muted)" }}
        >
          {activity.bestAccuracy !== null && (
            <span>{`${Math.round(activity.bestAccuracy)}%`}</span>
          )}
          <span>{practicedLabel}</span>
        </span>

        <span
          className="text-[11px] font-mono tabular-nums md:text-right"
          style={{ color: "var(--color-text-muted)" }}
        >
          {formatSongDuration(song.durationSeconds)}
        </span>
      </button>

      {isLoading && <LoadingOverlay radiusClass="rounded-lg" />}
    </div>
  );
}
