import { AlertTriangle, ArrowLeft, PanelRightOpen } from "lucide-react";
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
      className={`surface-panel subtle-shadow ${
        isSplitMode ? "px-2 py-1.5 mb-1.5" : "px-2.5 py-2 mb-2"
      }`}
      style={{
        borderRadius: "1.1rem",
      }}
      data-testid="playback-header-panel"
    >
      <div className="flex items-center gap-1.5 justify-between min-w-0">
        <div
          className="min-w-0 flex-1 flex items-center gap-1.5 overflow-hidden"
          data-testid="playback-title-meta-row"
        >
          <span className="kicker-label shrink-0 text-[11px]">
            {t("app.subtitle")}
          </span>
          <h2
            className="font-semibold font-body truncate text-[1.02rem] leading-tight max-w-[min(40vw,420px)]"
            data-testid="playback-song-title"
          >
            {songTitle}
          </h2>
        </div>

        <div
          className="flex flex-wrap items-center justify-end gap-1 shrink-0 max-w-full"
          data-testid="playback-header-actions"
        >
          <DisplayModeToggle />
          <button
            ref={playbackDrawerTriggerRef}
            onClick={onOpenPlaybackDrawer}
            className="btn-surface-themed flex min-h-9 items-center gap-1 rounded-lg font-body cursor-pointer px-2 py-[3px] text-[10px]"
            data-testid="playback-drawer-trigger"
            aria-label={t("settings.title")}
          >
            <PanelRightOpen size={13} />
            <span className="hidden sm:inline">{t("settings.title")}</span>
          </button>
          <button
            onClick={onExitPlayback}
            className="btn-surface-themed flex min-h-9 items-center gap-1 rounded-lg font-body cursor-pointer px-2 py-[3px] text-[10px]"
            aria-label={t("song.backToLibrary")}
          >
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">{t("song.backToLibrary")}</span>
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
