import { AlertTriangle, ArrowLeft, SlidersHorizontal } from "lucide-react";
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
}

export function PlaybackHeader({
  songTitle,
  isSplitMode,
  playbackDrawerTriggerRef,
  onOpenPlaybackDrawer,
  onExitPlayback,
  midiDiagnosticNotice,
  browseRoute = "menu",
}: PlaybackHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

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
            className="m-0 min-w-0 truncate font-display text-xl font-extrabold leading-tight"
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
          className="mt-1.5 flex items-start gap-1.5 rounded-lg px-2 py-1 text-[11px] leading-snug"
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
          <AlertTriangle size={13} className="mt-[1px] shrink-0" />
          <div className="min-w-0">
            <span className="font-semibold">{midiDiagnosticNotice.title}</span>
            <span className="ml-1">{midiDiagnosticNotice.summary}</span>
            {midiDiagnosticNotice.details.length > 0 && (
              <span className="ml-1 text-[10px] opacity-80">
                {midiDiagnosticNotice.details[0]}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
