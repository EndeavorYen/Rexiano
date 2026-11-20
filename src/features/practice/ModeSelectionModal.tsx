import { useRef } from "react";
import { ArrowLeft, Ear, Hand } from "lucide-react";
import type { PracticeMode } from "@shared/types";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { getModeSelectionOptions } from "./modeSelectionOptions";
import "./play-feedback.css";

export interface ModeSelectionModalProps {
  /** Shown above the cards so the child knows which song this is for */
  songTitle?: string;
  onSelect: (mode: PracticeMode) => void;
  onDismiss: () => void;
}

/**
 * Two big cards before a song starts: listen first, or play along. Play along
 * is the sun-yellow one and holds the focus; listening is a plain white card.
 */
export function ModeSelectionModal({
  songTitle,
  onSelect,
  onDismiss,
}: ModeSelectionModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const options = getModeSelectionOptions();
  useDialogFocus({
    active: true,
    containerRef: dialogRef,
    initialFocusRef: primaryRef,
    onDismiss,
  });

  return (
    <div
      className="family-scrim mode-selection-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      data-testid="mode-selection-backdrop"
    >
      <div
        ref={dialogRef}
        className="family-sheet play-mode-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("modeSelect.title")}
        tabIndex={-1}
      >
        <div className="play-mode-head">
          {songTitle && (
            <p className="play-mode-song" data-testid="mode-select-song">
              {songTitle}
            </p>
          )}
          <h2>{t("modeSelect.title")}</h2>
        </div>

        <div className="play-mode-grid">
          {options.map((opt) => (
            <button
              key={opt.mode}
              ref={opt.isPrimary ? primaryRef : undefined}
              type="button"
              onClick={() => onSelect(opt.mode)}
              className={`play-mode-card${opt.isPrimary ? " is-primary" : ""}`}
              data-testid={`mode-select-${opt.mode}`}
            >
              <span className="play-mode-card-icon" aria-hidden="true">
                {opt.mode === "watch" ? (
                  <Ear size={30} strokeWidth={2.2} />
                ) : (
                  <Hand size={30} strokeWidth={2.2} />
                )}
              </span>
              <span className="play-mode-card-title">{t(opt.titleKey)}</span>
              <span className="play-mode-card-desc">{t(opt.descKey)}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="btn-ghost-themed play-mode-back"
          data-testid="mode-select-back"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t("modeSelect.backToLibrary")}
        </button>
      </div>
    </div>
  );
}
