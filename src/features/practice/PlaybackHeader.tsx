import { AlertTriangle, ArrowLeft, SlidersHorizontal } from "lucide-react";
import { DisplayModeToggle } from "@renderer/features/sheetMusic/DisplayModeToggle";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { MidiDiagnosticNotice } from "@renderer/features/midiDiagnostics/midiDiagnosticNotice";

export interface PlaybackHeaderProps {
  songTitle: string;
  isSplitMode: boolean;
  playbackDrawerTriggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpenPlaybackDrawer: () => void;
  onExitPlayback: () => void;
  midiDiagnosticNotice: MidiDiagnosticNotice | null;
}

export function PlaybackHeader({
  songTitle,
  isSplitMode,
  playbackDrawerTriggerRef,
  onOpenPlaybackDrawer,
  onExitPlayback,
  midiDiagnosticNotice,
}: PlaybackHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className={isSplitMode ? "mb-1.5" : "mb-2"}
      data-testid="playback-header-panel"
    >
      <div className="family-bar min-w-0" style={{ minHeight: 48 }}>
        <button
          onClick={onExitPlayback}
          className="icon-btn"
          aria-label={t("song.backToLibrary")}
          title={t("song.backToLibrary")}
        >
          <ArrowLeft size={20} />
        </button>
        <div
          className="min-w-0 flex-1 flex items-baseline gap-2 overflow-hidden"
          data-testid="playback-title-meta-row"
        >
          <h2
            className="m-0 truncate font-display text-xl font-extrabold leading-tight"
            data-testid="playback-song-title"
          >
            {songTitle}
          </h2>
          <span
            className="hidden shrink-0 text-sm font-bold md:inline"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("app.subtitle")}
          </span>
        </div>

        <div
          className="flex items-center justify-end gap-2 shrink-0"
          data-testid="playback-header-actions"
        >
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
