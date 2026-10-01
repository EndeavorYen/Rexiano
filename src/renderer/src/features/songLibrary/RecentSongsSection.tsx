import { PlayCircle, AlertCircle } from "lucide-react";
import { displayTitleForName } from "./songTitle";
import { useSongLibraryStore } from "@renderer/stores/useSongLibraryStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { formatRelativeTime } from "@renderer/utils/relativeTime";
import type { RecentFileRecovery } from "./recentFileRecovery";
import type { RecentFile } from "@shared/types";

export interface RecentSongsSectionProps {
  recentFiles: RecentFile[];
  loadingRecentPath: string | null;
  recentRecovery: RecentFileRecovery | null;
  onSelectRecent: (file: RecentFile) => void;
  onRemoveRecent: (filePath: string) => void;
  rememberReturnFocus: (testId: string) => void;
}

export function RecentSongsSection({
  recentFiles,
  loadingRecentPath,
  recentRecovery,
  onSelectRecent,
  onRemoveRecent,
  rememberReturnFocus,
}: RecentSongsSectionProps): React.JSX.Element | null {
  const { t, lang } = useTranslation();
  const catalogue = useSongLibraryStore((s) => s.songs);

  const continueRecent = recentFiles[0] ?? null;
  if (!continueRecent) return null;

  const RECENT_DISPLAY_LIMIT = 5;
  const visibleRecents = recentFiles.slice(0, RECENT_DISPLAY_LIMIT);

  return (
    <section
      className="surface-elevated mb-5 p-4 animate-page-enter"
      data-testid="song-library-continue"
    >
      <button
        onClick={() => {
          rememberReturnFocus("song-library-continue-action");
          onSelectRecent(continueRecent);
        }}
        disabled={loadingRecentPath === continueRecent.path}
        className="group flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3 text-left cursor-pointer transition-all duration-150 disabled:opacity-60 disabled:cursor-wait"
        style={{
          background:
            "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
          border:
            "1px solid color-mix(in srgb, var(--color-accent) 20%, var(--color-border))",
        }}
        title={continueRecent.path}
        data-testid="song-library-continue-action"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "var(--color-accent)",
              color: "var(--color-on-accent)",
            }}
          >
            {loadingRecentPath === continueRecent.path ? (
              <span
                className="h-4 w-4 rounded-full border-2 animate-spin"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--color-on-accent) 45%, transparent)",
                  borderTopColor: "var(--color-on-accent)",
                }}
              />
            ) : (
              <PlayCircle size={20} />
            )}
          </span>
          <span className="min-w-0">
            <span
              className="block text-xs font-body font-semibold uppercase tracking-wide"
              style={{ color: "var(--color-accent-text)" }}
            >
              {t("library.continuePractice")}
            </span>
            <span
              className="block truncate text-base font-display font-bold"
              style={{ color: "var(--color-text)" }}
            >
              {displayTitleForName(continueRecent.name, catalogue, lang)}
            </span>
            <span
              className="block text-xs font-body"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("library.continueHint")} ·{" "}
              {formatRelativeTime(continueRecent.timestamp, t)}
            </span>
          </span>
        </div>
      </button>

      {visibleRecents.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleRecents.slice(1).map((file, idx) => (
            <button
              key={file.path}
              onClick={() => onSelectRecent(file)}
              disabled={loadingRecentPath === file.path}
              className="card-hover animate-page-enter group relative min-w-[170px] max-w-[260px] flex flex-col items-start gap-1 rounded-lg px-3 py-2 text-xs font-body font-medium cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-wait"
              style={{
                background:
                  "color-mix(in srgb, var(--color-surface) 82%, transparent)",
                color: "var(--color-text)",
                border: "1px solid var(--color-border)",
                animationDelay: `${idx * 40}ms`,
              }}
              title={file.path}
            >
              <span
                className="w-full text-left leading-tight"
                style={{
                  color: "var(--color-text)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {displayTitleForName(file.name, catalogue, lang)}
              </span>
              <span
                className="shrink-0 opacity-70 font-mono tabular-nums text-[11px]"
                style={{ color: "var(--color-text-muted)" }}
              >
                {formatRelativeTime(file.timestamp, t)}
              </span>
            </button>
          ))}
        </div>
      )}
      {recentRecovery && (
        <div
          className="flex flex-wrap items-center gap-2 mt-2 text-xs font-body"
          style={{ color: "var(--color-danger-text)" }}
          title={recentRecovery.guidance.diagnostic || undefined}
          data-testid="recent-file-recovery"
        >
          <AlertCircle size={12} />
          <span className="min-w-0">
            <span className="font-semibold">
              {recentRecovery.guidance.title}
            </span>
            <span className="ml-1">{recentRecovery.guidance.guidance}</span>
          </span>
          {recentRecovery.canRemove && (
            <button
              onClick={() => onRemoveRecent(recentRecovery.removePath)}
              className="btn-surface-themed rounded-md px-2 py-0.5 text-[10px] font-body cursor-pointer"
              style={{ color: "var(--color-text)" }}
              data-testid="recent-file-remove-stale"
            >
              {recentRecovery.actionLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
