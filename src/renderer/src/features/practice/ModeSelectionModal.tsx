import { useRef } from "react";
import { ArrowLeft, Eye, Hand } from "lucide-react";
import type { PracticeMode } from "@shared/types";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { getModeSelectionOptions } from "./modeSelectionOptions";

export interface ModeSelectionModalProps {
  defaultMode: PracticeMode;
  onSelect: (mode: PracticeMode) => void;
  onDismiss: () => void;
}

function ModeIcon({ mode }: { mode: PracticeMode }): React.JSX.Element {
  if (mode === "wait") return <Hand size={28} />;
  return <Eye size={28} />;
}

/**
 * Mode selection modal shown before playback begins.
 * Live path offers Watch / Wait only.
 */
export function ModeSelectionModal({
  defaultMode,
  onSelect,
  onDismiss,
}: ModeSelectionModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const defaultButtonRef = useRef<HTMLButtonElement>(null);
  const options = getModeSelectionOptions(defaultMode);
  useDialogFocus({
    active: true,
    containerRef: dialogRef,
    initialFocusRef: defaultButtonRef,
    onDismiss,
  });

  return (
    <div
      className="mode-selection-backdrop fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto overscroll-contain p-4 modal-backdrop-cinematic"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
      data-testid="mode-selection-backdrop"
    >
      <div
        ref={dialogRef}
        className="mode-selection-dialog max-h-[calc(100vh-2rem)] w-full max-w-[680px] overflow-y-auto rounded-2xl shadow-2xl modal-card-cinematic p-4 sm:w-[92vw] sm:p-6"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 90%, transparent)",
          border: "1px solid var(--color-border)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t("modeSelect.title")}
        tabIndex={-1}
      >
        {/* Title */}
        <div className="mode-selection-kicker flex justify-center mb-1">
          <span className="kicker-label">{t("app.subtitle")}</span>
        </div>
        <h2
          className="mode-selection-title text-xl font-display font-bold text-center mb-1"
          style={{ color: "var(--color-text)" }}
        >
          {t("modeSelect.title")}
        </h2>
        <p
          className="mode-selection-subtitle text-sm font-body text-center mb-6"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("modeSelect.subtitle")}
        </p>

        {/* Mode cards */}
        <div className="mode-selection-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
          {options.map((opt, idx) => (
            <button
              key={opt.mode}
              ref={opt.isDefault ? defaultButtonRef : undefined}
              onClick={() => onSelect(opt.mode)}
              className="mode-selection-card card-hover animate-page-enter relative flex min-h-[120px] cursor-pointer flex-col items-center gap-2 rounded-xl p-3 transition-all sm:min-h-[170px] sm:gap-3 sm:p-4"
              style={{
                background:
                  "color-mix(in srgb, var(--color-surface-alt) 80%, var(--color-surface))",
                border: opt.isDefault
                  ? "2px solid var(--color-accent)"
                  : "1px solid var(--color-border)",
                animationDelay: `${idx * 70}ms`,
              }}
              aria-label={`${t(opt.titleKey)}${
                opt.isDefault ? `, ${t("modeSelect.currentDefault")}` : ""
              }`}
              data-testid={`mode-select-${opt.mode}`}
            >
              {opt.isDefault && (
                <span
                  className="mode-selection-default-badge absolute right-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-body font-bold uppercase tracking-wide"
                  style={{
                    color: "var(--color-accent-text)",
                    background:
                      "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))",
                  }}
                  data-testid="mode-select-current-default"
                >
                  {t("modeSelect.currentDefault")}
                </span>
              )}
              <div
                className="mode-selection-card-icon w-11 h-11 rounded-full flex items-center justify-center"
                style={{
                  color: "var(--color-accent)",
                  background:
                    "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))",
                  border:
                    "1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border))",
                }}
              >
                <ModeIcon mode={opt.mode} />
              </div>
              <span
                className="mode-selection-card-title text-sm font-display font-bold"
                style={{ color: "var(--color-text)" }}
              >
                {t(opt.titleKey)}
              </span>
              <span
                className="mode-selection-card-description text-[11px] font-body text-center leading-relaxed"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t(opt.descKey)}
              </span>
            </button>
          ))}
        </div>

        <p
          className="mode-selection-help text-[11px] font-body text-center mt-4"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("modeSelect.mustChoose")}
        </p>
        <div className="mode-selection-actions mt-3 flex justify-center">
          <button
            type="button"
            onClick={onDismiss}
            className="mode-selection-back btn-surface-themed flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-body font-semibold cursor-pointer"
            data-testid="mode-select-back"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {t("modeSelect.backToLibrary")}
          </button>
        </div>
      </div>
    </div>
  );
}
