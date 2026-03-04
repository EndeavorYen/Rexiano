/**
 * Phase 6: Track selector — per-track toggles for split-hand practice.
 * In wait mode, at least one track must remain active.
 */
import { useCallback, useState } from "react";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { X } from "lucide-react";

/** Track selection panel with All/Mute/Solo controls. */
export function TrackSelector(): React.JSX.Element {
  const { t } = useTranslation();
  const song = useSongStore((s) => s.song);
  const activeTracks = usePracticeStore((s) => s.activeTracks);
  const setActiveTracks = usePracticeStore((s) => s.setActiveTracks);
  const mode = usePracticeStore((s) => s.mode);
  const [hintDismissed, setHintDismissed] = useState(false);

  const tracks = song?.tracks ?? [];

  // In wait mode, at least one track must remain active so WaitMode has
  // notes to wait for. Prevent deselecting the very last active track.
  const handleToggle = useCallback(
    (index: number) => {
      const next = new Set(activeTracks);
      if (next.has(index)) {
        // Guard: don't allow empty active tracks in wait mode
        if (mode === "wait" && next.size <= 1) return;
        next.delete(index);
      } else {
        next.add(index);
      }
      setActiveTracks(next);
    },
    [activeTracks, setActiveTracks, mode],
  );

  if (tracks.length === 0) return <></>;

  // Mute All is disabled in wait mode — having zero active tracks would
  // let WaitMode play through without ever waiting for input.
  const isMuteAllDisabled = mode === "wait";

  const setAllTracks = (): void => {
    const next = new Set<number>();
    for (let i = 0; i < tracks.length; i++) {
      next.add(i);
    }
    setActiveTracks(next);
  };

  const muteAllTracks = (): void => {
    if (isMuteAllDisabled) return;
    setActiveTracks(new Set<number>());
  };

  const soloTrack = (index: number): void => {
    setActiveTracks(new Set<number>([index]));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="text-[10px] font-mono uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {t("practice.tracks")}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={muteAllTracks}
          disabled={isMuteAllDisabled}
          className="px-2 py-0.5 rounded text-[10px] font-body font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            color: "var(--color-text-muted)",
            background:
              "color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-surface))",
            border: "1px solid var(--color-border)",
          }}
          title={
            isMuteAllDisabled ? t("practice.muteAllDisabledWait") : undefined
          }
        >
          {t("practice.muteAll")}
        </button>
        <button
          onClick={setAllTracks}
          className="px-2 py-0.5 rounded text-[10px] font-body font-medium cursor-pointer"
          style={{
            color: "var(--color-text-muted)",
            background:
              "color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-surface))",
            border: "1px solid var(--color-border)",
          }}
        >
          {t("practice.resetTracks")}
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {tracks.map((track, i) => {
          const isActive = activeTracks.has(i);
          return (
            <label
              key={i}
              className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-colors duration-100"
              style={{
                background: isActive
                  ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                  : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => handleToggle(i)}
                className="accent-[var(--color-accent)] cursor-pointer"
                aria-label={t("practice.trackN", { n: i + 1 })}
              />
              <span
                className="text-xs font-body truncate"
                style={{
                  color: isActive
                    ? "var(--color-text)"
                    : "var(--color-text-muted)",
                }}
              >
                {track.name || t("practice.trackN", { n: i + 1 })}
              </span>
              <span
                className="text-[10px] font-mono ml-auto shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("practice.notesCount", { count: track.notes.length })}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  soloTrack(i);
                }}
                className="px-1.5 py-0.5 rounded text-[9px] font-body font-medium cursor-pointer"
                style={{
                  color: "var(--color-text-muted)",
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 76%, var(--color-surface))",
                  border: "1px solid var(--color-border)",
                }}
              >
                {t("practice.solo")}
              </button>
            </label>
          );
        })}
      </div>

      {/* Hand-separation guidance hint */}
      {tracks.length >= 2 &&
        activeTracks.size === 1 &&
        !hintDismissed && (
          <div
            className="flex items-start gap-2 px-2.5 py-2 rounded-md text-[11px] font-body mt-1"
            style={{
              color: "var(--color-text)",
              background:
                "color-mix(in srgb, var(--color-accent) 8%, var(--color-surface))",
              borderLeft: "3px solid var(--color-accent)",
            }}
            data-testid="hand-separation-hint"
            role="status"
          >
            <span className="flex-1">
              {t("practice.handSeparation.hint")}
            </span>
            <button
              onClick={() => setHintDismissed(true)}
              className="shrink-0 flex items-center justify-center rounded cursor-pointer"
              style={{
                width: 18,
                height: 18,
                color: "var(--color-text-muted)",
              }}
              aria-label={t("general.close")}
            >
              <X size={12} />
            </button>
          </div>
        )}
    </div>
  );
}
