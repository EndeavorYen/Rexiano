import { AlertTriangle, ArrowLeft, SlidersHorizontal, X } from "lucide-react";
import { describeMidiDiagnosticNotice } from "@renderer/features/midiDiagnostics/midiDiagnosticText";
import { DisplayModeToggle } from "@renderer/features/sheetMusic/DisplayModeToggle";
import { ScoreOverlay } from "./ScoreOverlay";
import type { BrowseRoute } from "@renderer/features/routing/useAppNavigation";
import { backLabelKey } from "@renderer/features/routing/browseRouteLabel";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { MidiDiagnosticNotice } from "@renderer/features/midiDiagnostics/midiDiagnosticNotice";

export interface PlaybackHeaderProps {
  songTitle: string;
  isSplitMode: boolean;
  playbackDrawerTriggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpenPlaybackDrawer: () => void;
  onExitPlayback: () => void;
  midiDiagnosticNotice: MidiDiagnosticNotice | null;
  /** The screen the song was started from: names the back button */
  browseRoute?: BrowseRoute;
  /** Hides the quality notice for this song until it is opened again */
  onDismissMidiNotice?: () => void;
}

export function PlaybackHeader({
  songTitle,
  isSplitMode,
  playbackDrawerTriggerRef,
  onOpenPlaybackDrawer,
  onExitPlayback,
  midiDiagnosticNotice,
  browseRoute = "menu",
  onDismissMidiNotice,
}: PlaybackHeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const noticeText = midiDiagnosticNotice
    ? describeMidiDiagnosticNotice(midiDiagnosticNotice, t)
    : null;

  return (
    <div
      className={isSplitMode ? "mb-1.5" : "mb-2"}
      data-testid="playback-header-panel"
    >
      <div className="family-bar play-bar min-w-0">
        <div className="play-bar-start" data-testid="playback-title-meta-row">
          <button
            onClick={onExitPlayback}
            className="icon-btn"
            aria-label={t(backLabelKey(browseRoute))}
            title={t(backLabelKey(browseRoute))}
          >
            <ArrowLeft size={20} />
          </button>
          <h2
            className="m-0 min-w-0 truncate font-display text-xl font-extrabold leading-[1.6]"
            data-testid="playback-song-title"
            title={songTitle}
          >
            {songTitle}
          </h2>
        </div>

        <div className="play-bar-center">
          <ScoreOverlay />
        </div>

        <div className="play-bar-end" data-testid="playback-header-actions">
          <DisplayModeToggle />
          <button
            ref={playbackDrawerTriggerRef}
            onClick={onOpenPlaybackDrawer}
            className="icon-btn"
            data-testid="playback-drawer-trigger"
            aria-label={t("settings.title")}
            title={t("settings.title")}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>
      </div>
      {midiDiagnosticNotice && (
        <div
          className="mt-1.5 flex items-center gap-2 rounded-xl py-1 pl-3 pr-1 text-[13px] leading-snug"
          style={{
            color:
              midiDiagnosticNotice.kind === "error"
                ? "#991b1b"
                : "var(--color-text)",
            background:
              midiDiagnosticNotice.kind === "error"
                ? "color-mix(in srgb, #fee2e2 82%, var(--color-surface))"
                : "color-mix(in srgb, var(--color-streak-gold) 18%, var(--color-surface))",
            border:
              midiDiagnosticNotice.kind === "error"
                ? "1px solid color-mix(in srgb, #dc2626 35%, transparent)"
                : "1px solid color-mix(in srgb, var(--color-streak-gold) 40%, transparent)",
          }}
          title={midiDiagnosticNotice.diagnosticTitle}
          data-testid="midi-diagnostic-notice"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">{noticeText?.title}</span>
            <span className="ml-2">{noticeText?.body}</span>
          </div>
          {onDismissMidiNotice && (
            <button
              type="button"
              onClick={onDismissMidiNotice}
              className="icon-btn"
              aria-label={t("midiNotice.dismiss")}
              title={t("midiNotice.dismiss")}
              data-testid="midi-diagnostic-dismiss"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
