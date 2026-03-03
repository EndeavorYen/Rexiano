import { Hand, Music } from "lucide-react";
import type { PracticeMode } from "@shared/types";
import { useTranslation } from "@renderer/i18n/useTranslation";

interface ModeSelectionModalProps {
  onSelect: (mode: PracticeMode) => void;
}

interface ModeOption {
  mode: PracticeMode;
  icon: React.ReactNode;
  titleKey: "practice.wait" | "practice.free";
  descKey: "modeSelect.waitDesc" | "modeSelect.freeDesc";
  accentStyle: React.CSSProperties;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    mode: "wait",
    icon: <Hand size={28} />,
    titleKey: "practice.wait",
    descKey: "modeSelect.waitDesc",
    accentStyle: { color: "var(--color-accent)" },
  },
  {
    mode: "free",
    icon: <Music size={28} />,
    titleKey: "practice.free",
    descKey: "modeSelect.freeDesc",
    accentStyle: { color: "var(--color-accent)" },
  },
];

/**
 * Synthesia-style mode selection modal shown before playback begins.
 * User picks Wait / Free to configure how the session will run.
 */
export function ModeSelectionModal({
  onSelect,
}: ModeSelectionModalProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center modal-backdrop-cinematic"
      data-testid="mode-selection-modal-backdrop"
    >
      <div
        className="w-[92vw] max-w-[560px] rounded-2xl shadow-2xl modal-card-cinematic p-5 sm:p-6"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 90%, transparent)",
          border: "1px solid var(--color-border)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t("modeSelect.title")}
        data-testid="mode-selection-modal"
      >
        {/* Title */}
        <div className="flex justify-center mb-1">
          <span className="kicker-label">{t("app.subtitle")}</span>
        </div>
        <h2
          className="text-xl font-display font-bold text-center mb-1"
          style={{ color: "var(--color-text)" }}
        >
          {t("modeSelect.title")}
        </h2>
        <p
          className="text-sm font-body text-center mb-6"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("modeSelect.subtitle")}
        </p>

        {/* Mode cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_OPTIONS.map((opt, idx) => (
            <button
              key={opt.mode}
              onClick={() => onSelect(opt.mode)}
              className="card-hover animate-page-enter flex flex-col items-center gap-3 p-4 rounded-xl cursor-pointer transition-all min-h-[170px]"
              style={{
                background:
                  "color-mix(in srgb, var(--color-surface-alt) 80%, var(--color-surface))",
                border: "1px solid var(--color-border)",
                animationDelay: `${idx * 70}ms`,
              }}
              data-testid={`mode-select-${opt.mode}`}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{
                  ...opt.accentStyle,
                  background:
                    "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))",
                  border:
                    "1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border))",
                }}
              >
                {opt.icon}
              </div>
              <span
                className="text-sm font-display font-bold"
                style={{ color: "var(--color-text)" }}
              >
                {t(opt.titleKey)}
              </span>
              <span
                className="text-[11px] font-body text-center leading-relaxed"
                style={{ color: "var(--color-text-muted)" }}
              >
                {t(opt.descKey)}
              </span>
            </button>
          ))}
        </div>

        <p
          className="text-[11px] font-body text-center mt-4"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("modeSelect.mustChoose")}
        </p>
      </div>
    </div>
  );
}
