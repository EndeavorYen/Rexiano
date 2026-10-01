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

  if (recentFiles.length === 0) return null;

  const RECENT_DISPLAY_LIMIT = 5;
  const visibleRecents = recentFiles.slice(0, RECENT_DISPLAY_LIMIT);

  // A compact list: the one big "play next" entry is the lesson path (#307).
  return (
    <section
      className="surface-elevated mb-5 p-4 animate-page-enter"
      data-testid="song-library-continue"
    >
      <div className="mb-2 flex items-center gap-2">
        <PlayCircle size={14} style={{ color: "var(--color-accent-text)" }} />
        <span
          className="text-xs font-body font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-accent-text)" }}
        >
          {t("library.recentlyPlayed")}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleRecents.map((file, idx) => {
          const isLatest = idx === 0;
          return (
            <button
              key={file.path}
              onClick={() => {
                if (isLatest) {
                  rememberReturnFocus("song-library-continue-action");
                }
                onSelectRecent(file);
              }}
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
              data-testid={
                isLatest ? "song-library-continue-action" : undefined
              }
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
          );
        })}
      </div>
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
