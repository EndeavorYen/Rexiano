import { useCallback } from "react";
import { useSongStore } from "@renderer/stores/useSongStore";
import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TrackHandAssignment } from "@renderer/engines/midi/TrackHandAssignment";
import {
  applyTrackHandAssignmentChangeForSong,
  applyTrackPreferenceChangeForSong,
} from "./practiceSetupControlActions";
import { saveSongPracticeSetupPatchForSong } from "./songPracticeSetup";

const TRACK_COLOR_FALLBACKS = ["#9b7fd4", "#c084cf", "#7ba4d9", "#a8d4a0"];

interface TrackSelectorProps {
  compact?: boolean;
}

function colorInputValue(
  color: string | undefined,
  trackIndex: number,
): string {
  if (color && /^#[0-9a-fA-F]{6}$/.test(color.trim())) {
    return color.trim();
  }
  return TRACK_COLOR_FALLBACKS[trackIndex % TRACK_COLOR_FALLBACKS.length];
}

export function TrackSelector({
  compact = false,
}: TrackSelectorProps): React.JSX.Element {
  const { t } = useTranslation();
  const song = useSongStore((s) => s.song);
  const mode = usePracticeStore((s) => s.mode);
  const speed = usePracticeStore((s) => s.speed);
  const activeTracks = usePracticeStore((s) => s.activeTracks);
  const handAssignments = usePracticeStore((s) => s.handAssignments);
  const trackPreferences = usePracticeStore((s) => s.trackPreferences);
  const setActiveTracks = usePracticeStore((s) => s.setActiveTracks);
  const setHandAssignments = usePracticeStore((s) => s.setHandAssignments);
  const setTrackPreferences = usePracticeStore((s) => s.setTrackPreferences);

  const tracks = song?.tracks ?? [];

  const applyActiveTracks = useCallback(
    (next: Set<number>) => {
      setActiveTracks(next);
      if (song) {
        saveSongPracticeSetupPatchForSong(
          song,
          { defaultMode: mode, defaultSpeed: speed },
          { activeTracks: [...next], defaultMode: mode, defaultSpeed: speed },
        );
      }
    },
    [mode, setActiveTracks, song, speed],
  );

  const handleToggle = useCallback(
    (index: number) => {
      const next = new Set(activeTracks);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      applyActiveTracks(next);
    },
    [activeTracks, applyActiveTracks],
  );

  const handleHandAssignmentChange = useCallback(
    (index: number, nextAssignment: TrackHandAssignment) => {
      applyTrackHandAssignmentChangeForSong(
        {
          song,
          activeTracks,
          currentMode: mode,
          currentSpeed: speed,
          handAssignments,
          trackPreferences,
          setActiveTracks,
          setHandAssignments,
        },
        index,
        nextAssignment,
      );
    },
    [
      activeTracks,
      handAssignments,
      mode,
      setActiveTracks,
      setHandAssignments,
      song,
      speed,
      trackPreferences,
    ],
  );

  const handleTrackPreferenceChange = useCallback(
    (
      index: number,
      patch: { color?: string; muted?: boolean; backgroundVisible?: boolean },
    ) => {
      applyTrackPreferenceChangeForSong(
        {
          song,
          activeTracks,
          currentMode: mode,
          currentSpeed: speed,
          handAssignments,
          trackPreferences,
          setTrackPreferences,
        },
        index,
        patch,
      );
    },
    [
      activeTracks,
      handAssignments,
      mode,
      setTrackPreferences,
      song,
      speed,
      trackPreferences,
    ],
  );

  if (tracks.length === 0) return <></>;

  const setAllTracks = (): void => {
    const next = new Set<number>();
    for (let i = 0; i < tracks.length; i++) {
      if (handAssignments[i] !== "background") {
        next.add(i);
      }
    }
    applyActiveTracks(next);
  };

  const muteAllTracks = (): void => {
    applyActiveTracks(new Set<number>());
  };

  const soloTrack = (index: number): void => {
    applyActiveTracks(new Set<number>([index]));
  };

  return (
    <div className="flex max-w-full flex-col gap-1.5">
      <span
        className="text-[10px] font-mono uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {t("practice.tracks")}
      </span>

      <div className="flex flex-wrap items-center gap-1">
        <button
          onClick={muteAllTracks}
          className="min-h-9 px-2 py-0.5 rounded text-[10px] font-body font-medium cursor-pointer"
          style={{
            color: "var(--color-text-muted)",
            background:
              "color-mix(in srgb, var(--color-surface-alt) 72%, var(--color-surface))",
            border: "1px solid var(--color-border)",
          }}
        >
          {t("practice.muteAll")}
        </button>
        <button
          onClick={setAllTracks}
          className="min-h-9 px-2 py-0.5 rounded text-[10px] font-body font-medium cursor-pointer"
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

      <div className="flex max-w-full flex-col gap-0.5">
        {tracks.map((track, i) => {
          const isActive = activeTracks.has(i);
          const assignment =
            handAssignments[i] ?? (isActive ? "both" : "background");
          const preference = trackPreferences[i] ?? {};
          const isBackground = assignment === "background";
          return (
            <div
              key={i}
              className="flex max-w-full flex-wrap items-center gap-2 px-2 py-1 rounded transition-colors duration-100"
              style={{
                background: isActive
                  ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                  : "transparent",
              }}
            >
              <label
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-md cursor-pointer"
                data-testid="track-active-toggle"
                aria-label={t("practice.trackN", { n: i + 1 })}
                style={{
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 58%, transparent)",
                  opacity: isBackground ? 0.55 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={isActive}
                  disabled={isBackground}
                  onChange={() => handleToggle(i)}
                  className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  aria-label={t("practice.trackN", { n: i + 1 })}
                />
              </label>
              <span
                className="min-w-0 max-w-[9rem] text-xs font-body truncate"
                style={{
                  color: isActive
                    ? "var(--color-text)"
                    : "var(--color-text-muted)",
                }}
              >
                {track.name || t("practice.trackN", { n: i + 1 })}
              </span>
              <span
                className="text-[10px] font-mono shrink-0 sm:ml-auto"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t("practice.notesCount", { count: track.notes.length })}
              </span>
              <select
                value={assignment}
                onChange={(e) =>
                  handleHandAssignmentChange(
                    i,
                    e.target.value as TrackHandAssignment,
                  )
                }
                className="min-h-9 rounded px-2 py-0.5 text-[10px] font-body cursor-pointer"
                data-testid="track-hand-select"
                style={{
                  color: "var(--color-text)",
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 76%, var(--color-surface))",
                  border: "1px solid var(--color-border)",
                }}
                aria-label={t("practice.trackHand", { n: i + 1 })}
              >
                <option value="right">{t("practice.handRight")}</option>
                <option value="left">{t("practice.handLeft")}</option>
                <option value="both">{t("practice.handBoth")}</option>
                <option value="background">
                  {t("practice.handBackground")}
                </option>
              </select>
              <label
                className="flex min-h-9 items-center gap-1 rounded-md px-2 text-[10px] font-body cursor-pointer"
                data-testid="track-sound-toggle"
                style={{ color: "var(--color-text-muted)" }}
              >
                <input
                  type="checkbox"
                  checked={preference.muted !== true}
                  onChange={(e) =>
                    handleTrackPreferenceChange(i, {
                      muted: !e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                  aria-label={t("practice.trackSound", { n: i + 1 })}
                />
                {t("practice.sound")}
              </label>
              {isBackground && (
                <label
                  className="flex min-h-9 items-center gap-1 rounded-md px-2 text-[10px] font-body cursor-pointer"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  <input
                    type="checkbox"
                    checked={preference.backgroundVisible !== false}
                    onChange={(e) =>
                      handleTrackPreferenceChange(i, {
                        backgroundVisible: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[var(--color-accent)] cursor-pointer"
                    aria-label={t("practice.trackVisible", { n: i + 1 })}
                  />
                  {t("practice.visible")}
                </label>
              )}
              <input
                type="color"
                value={colorInputValue(preference.color, i)}
                onChange={(e) =>
                  handleTrackPreferenceChange(i, { color: e.target.value })
                }
                className={`h-9 w-9 cursor-pointer rounded border-0 bg-transparent p-1 ${
                  compact ? "-translate-y-1" : ""
                }`}
                data-testid="track-color-input"
                aria-label={t("practice.trackColor", { n: i + 1 })}
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  soloTrack(i);
                }}
                disabled={isBackground}
                className={`min-h-9 px-2 py-0.5 rounded text-[9px] font-body font-medium cursor-pointer ${
                  compact ? "-translate-y-1" : ""
                }`}
                data-testid="track-solo-toggle"
                style={{
                  color: isBackground
                    ? "color-mix(in srgb, var(--color-text-muted) 54%, transparent)"
                    : "var(--color-text-muted)",
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 76%, var(--color-surface))",
                  border: "1px solid var(--color-border)",
                }}
              >
                {t("practice.solo")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
