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
      className="set-card songbook-recent"
      data-testid="song-library-continue"
    >
      <div className="songbook-recent-head">
        <PlayCircle size={18} aria-hidden="true" />
        <span>{t("library.recentlyPlayed")}</span>
      </div>
      <div className="songbook-recent-list">
        {visibleRecents.map((file, idx) => {
          const isLatest = idx === 0;
          return (
            <button
              key={file.path}
              type="button"
              onClick={() => {
                if (isLatest) {
                  rememberReturnFocus("song-library-continue-action");
                }
                onSelectRecent(file);
              }}
              disabled={loadingRecentPath === file.path}
              className="btn-ghost-themed songbook-recent-item"
              title={file.path}
              data-testid={
                isLatest ? "song-library-continue-action" : undefined
              }
            >
              <span className="name">
                {displayTitleForName(file.name, catalogue, lang)}
              </span>
              <span className="when">
                {formatRelativeTime(file.timestamp, t)}
              </span>
            </button>
          );
        })}
      </div>
      {recentRecovery && (
        <div
          className="songbook-recent-recovery"
          title={recentRecovery.guidance.diagnostic || undefined}
          data-testid="recent-file-recovery"
        >
          <AlertCircle size={18} aria-hidden="true" />
          <span className="min-w-0">
            <strong>{recentRecovery.guidance.title}</strong>{" "}
            <span>{recentRecovery.guidance.guidance}</span>
          </span>
          {recentRecovery.canRemove && (
            <button
              type="button"
              onClick={() => onRemoveRecent(recentRecovery.removePath)}
              className="btn-ghost-themed"
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
