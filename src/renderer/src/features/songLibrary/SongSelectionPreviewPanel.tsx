import { useRef, useEffect } from "react";
import { PlayCircle } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { categoryLabelKeys, formatSongDuration } from "./songCardUtils";
import {
  buildSongPreviewSessionActions,
  type SongSelectionPreviewModel,
} from "./songLibrarySelectors";
import type { PracticeSessionIntent } from "@renderer/features/practice/sessionIntent";
import { formatSongTag, previewTags } from "./songTagLabel";

export function PreviewMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div
      className="min-w-0 rounded-lg px-3 py-2"
      style={{
        background: "color-mix(in srgb, var(--color-surface) 82%, transparent)",
        border: "1px solid var(--color-border)",
      }}
    >
      <dt
        className="truncate text-[10px] font-body font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </dt>
      <dd
        className="mt-1 truncate text-sm font-body font-semibold"
        style={{ color: "var(--color-text)" }}
      >
        {value}
      </dd>
    </div>
  );
}

export interface SongSelectionPreviewPanelProps {
  preview: SongSelectionPreviewModel;
  focusPrimaryAction: boolean;
  isLoading: boolean;
  audioStatus?: "idle" | "loading" | "playing";
  onStartSession: (
    preview: SongSelectionPreviewModel,
    intent: PracticeSessionIntent,
  ) => void;
  onToggleAudioPreview?: (preview: SongSelectionPreviewModel) => void;
}

export function SongSelectionPreviewPanel({
  preview,
  focusPrimaryAction,
  isLoading,
  onStartSession,
}: SongSelectionPreviewPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement | null>(null);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);
  const previewKey =
    preview.kind === "builtin"
      ? `builtin:${preview.song.id}`
      : `imported:${preview.importedSong.id}`;
  const shownTags = previewTags(preview.tags, preview.category ?? null);
  const category = preview.category
    ? t(categoryLabelKeys[preview.category])
    : "--";
  const bestScore =
    preview.bestAccuracy !== null
      ? `${Math.round(preview.bestAccuracy)}%`
      : t("library.neverPracticed");
  const sessionActions = buildSongPreviewSessionActions(preview.primaryCta);

  useEffect(() => {
    sectionRef.current?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "auto",
    });
    if (focusPrimaryAction) primaryActionRef.current?.focus();
  }, [focusPrimaryAction, previewKey]);

  return (
    <section
      ref={sectionRef}
      className="surface-elevated mb-5 p-4 animate-page-enter"
      data-testid="song-selection-preview"
      aria-label={t("library.preview.title")}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_auto] lg:items-center">
        <div className="min-w-0">
          <span
            className="kicker-label"
            style={{ color: "var(--color-accent-text)" }}
          >
            {t("library.preview.title")}
          </span>
          <h2
            className="mt-1 truncate text-xl font-display font-bold"
            style={{ color: "var(--color-text)" }}
            data-testid="song-selection-preview-title"
          >
            {preview.title}
          </h2>
          <p
            className="mt-1 truncate text-sm font-body"
            style={{ color: "var(--color-text-muted)" }}
          >
            {preview.composer}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          {sessionActions.map((action) => (
            <button
              key={action.intent}
              ref={action.emphasis === "primary" ? primaryActionRef : undefined}
              type="button"
              onClick={() => onStartSession(preview, action.intent)}
              disabled={isLoading}
              className={`${
                action.emphasis === "primary"
                  ? "btn-primary-themed"
                  : "btn-surface-themed"
              } flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-body font-semibold cursor-pointer disabled:cursor-wait disabled:opacity-60`}
              data-testid={`song-selection-preview-${action.intent}`}
            >
              {isLoading && action.emphasis === "primary" ? (
                <span
                  className="h-4 w-4 rounded-full border-2 animate-spin"
                  style={{
                    borderColor:
                      "color-mix(in srgb, var(--color-on-accent) 45%, transparent)",
                    borderTopColor: "var(--color-on-accent)",
                  }}
                />
              ) : (
                <PlayCircle size={16} />
              )}
              {t(action.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <PreviewMetric
          label={t("library.preview.length")}
          value={
            preview.durationSeconds !== null
              ? formatSongDuration(preview.durationSeconds)
              : "--"
          }
        />
        <PreviewMetric label={t("library.preview.category")} value={category} />
        <PreviewMetric
          label={t("library.preview.bestScore")}
          value={bestScore}
        />
        <PreviewMetric
          label={t("library.preview.tracks")}
          value={
            preview.trackCount !== null
              ? String(preview.trackCount)
              : t("library.preview.tracksAfterPractice")
          }
        />
      </dl>

      {shownTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {shownTags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="rounded-md px-2 py-1 text-[10px] font-body font-medium"
              style={{
                color: "var(--color-text-muted)",
                background: "var(--color-surface-alt)",
                border: "1px solid var(--color-border)",
              }}
            >
              {formatSongTag(tag, t)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
