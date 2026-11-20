import { usePracticeStore } from "@renderer/stores/usePracticeStore";
import { useSongStore } from "@renderer/stores/useSongStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { PracticeMode } from "@shared/types";
import type { TranslationKey } from "@renderer/i18n/types";
import { applyPracticeModeChangeForSong } from "./practiceSetupControlActions";
import "./play-feedback.css";

const modes: {
  id: PracticeMode;
  labelKey: TranslationKey;
  icon: React.JSX.Element;
}[] = [
  {
    id: "watch",
    labelKey: "practice.watch",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <ellipse
          cx="8"
          cy="8"
          rx="7"
          ry="4.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="8" cy="8" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "wait",
    labelKey: "practice.wait",
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <rect
          x="5.5"
          y="4.5"
          width="2"
          height="7"
          rx="0.5"
          fill="currentColor"
        />
        <rect
          x="8.5"
          y="4.5"
          width="2"
          height="7"
          rx="0.5"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

export function PracticeModeSelector(): React.JSX.Element {
  const { t } = useTranslation();
  const song = useSongStore((s) => s.song);
  const currentMode = usePracticeStore((s) => s.mode);
  const speed = usePracticeStore((s) => s.speed);
  const activeTracks = usePracticeStore((s) => s.activeTracks);
  const setMode = usePracticeStore((s) => s.setMode);

  return (
    <div
      className="segmented transport-segmented"
      role="radiogroup"
      aria-label={t("practice.modeLabel")}
    >
      {modes.map(({ id, labelKey, icon }) => {
        const isActive = currentMode === id;
        const label = t(labelKey);
        return (
          <button
            key={id}
            role="radio"
            aria-checked={isActive}
            onClick={() =>
              applyPracticeModeChangeForSong(
                {
                  song,
                  activeTracks,
                  currentSpeed: speed,
                  setMode,
                },
                id,
              )
            }
            className="transport-seg-btn"
            title={label}
            data-testid={`practice-mode-${id}`}
          >
            {icon}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
