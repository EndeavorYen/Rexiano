import { useEffect, useState, useCallback } from "react";
import {
  onHelpChange,
  getShowHelp,
  setShowHelp,
} from "@renderer/hooks/useKeyboardShortcuts";
import { useTranslation } from "@renderer/i18n/useTranslation";

interface ShortcutEntry {
  /** Key cap labels displayed as visual key-cap badges */
  keyCaps: string[];
  /** Description — either an i18n key result or a plain string */
  label: string;
}

/**
 * Renders a single visual key-cap badge (rounded rect with border + shadow).
 * Designed to look like a physical keyboard key.
 */
function KeyCap({ label }: { label: string }): React.JSX.Element {
  return (
    <kbd
      className="inline-flex items-center justify-center text-[11px] font-mono font-semibold rounded-md"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--color-surface-alt) 90%, var(--color-surface)) 0%, var(--color-surface-alt) 100%)",
        border: "1px solid var(--color-border)",
        boxShadow:
          "0 1px 0 color-mix(in srgb, var(--color-border) 60%, transparent), inset 0 1px 0 color-mix(in srgb, var(--color-surface) 40%, transparent)",
        color: "var(--color-text)",
        minWidth: 24,
        height: 22,
        padding: "0 5px",
        lineHeight: "22px",
      }}
    >
      {label}
    </kbd>
  );
}

/**
 * Renders a group of key-caps with "+" or "/" separators between them.
 */
function KeyCapGroup({
  caps,
  separator = "+",
}: {
  caps: string[];
  separator?: string;
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-0.5">
      {caps.map((cap, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && (
            <span
              className="text-[10px] font-mono mx-0.5"
              style={{ color: "var(--color-text-muted)", opacity: 0.6 }}
            >
              {separator}
            </span>
          )}
          <KeyCap label={cap} />
        </span>
      ))}
    </span>
  );
}

/**
 * Tiny inline shortcut hint badge for toolbar buttons.
 * Exported for use in TransportBar and other UI components.
 */
export function ShortcutBadge({
  label,
}: {
  label: string;
}): React.JSX.Element {
  return (
    <span
      className="inline-flex items-center justify-center text-[9px] font-mono rounded"
      style={{
        background:
          "color-mix(in srgb, var(--color-surface-alt) 60%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-border) 50%, transparent)",
        color: "var(--color-text-muted)",
        padding: "0 3px",
        height: 14,
        lineHeight: "14px",
        opacity: 0.7,
      }}
    >
      {label}
    </span>
  );
}

/**
 * Modal overlay that shows all keyboard shortcuts.
 * Toggled by pressing "?" and subscribes to the global help state
 * managed in useKeyboardShortcuts.ts.
 */
export function KeyboardShortcutsHelp(): React.JSX.Element | null {
  const [visible, setVisible] = useState(getShowHelp);
  const { t } = useTranslation();

  useEffect(() => {
    return onHelpChange((show) => setVisible(show));
  }, []);

  const close = useCallback((): void => setShowHelp(false), []);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, close]);

  if (!visible) return null;

  const shortcuts: ShortcutEntry[] = [
    { keyCaps: ["Space"], label: t("settings.shortcut.playPause") },
    { keyCaps: ["R"], label: t("settings.shortcut.restart") },
    { keyCaps: ["\u2190", "\u2192"], label: "Seek \u00B15s" },
    {
      keyCaps: ["Shift", "\u2190", "\u2192"],
      label: "Seek \u00B115s",
    },
    {
      keyCaps: ["\u2191", "\u2193"],
      label:
        t("settings.shortcut.speedUp") +
        " / " +
        t("settings.shortcut.speedDown"),
    },
    {
      keyCaps: ["A", "B"],
      label:
        t("settings.shortcut.loopA") + " / " + t("settings.shortcut.loopB"),
    },
    { keyCaps: ["L"], label: t("practice.clearLoop") },
    {
      keyCaps: ["1", "2", "3"],
      label:
        t("practice.watch") +
        " / " +
        t("practice.wait") +
        " / " +
        t("practice.free"),
    },
    { keyCaps: ["M"], label: t("audio.mute") + " / " + t("audio.unmute") },
    { keyCaps: ["Ctrl", "O"], label: "Open file" },
    { keyCaps: ["?"], label: "Toggle this help" },
    { keyCaps: ["Esc"], label: t("settings.shortcut.closeBack") },
  ];

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center modal-backdrop-cinematic"
      onClick={close}
      data-testid="keyboard-shortcuts-help-backdrop"
    >
      <div
        className="w-[92vw] max-w-[420px] rounded-2xl shadow-2xl modal-card-cinematic p-5 sm:p-6"
        style={{
          background:
            "color-mix(in srgb, var(--color-surface) 94%, transparent)",
          border: "1px solid var(--color-border)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.keyboardShortcuts")}
        onClick={(e) => e.stopPropagation()}
        data-testid="keyboard-shortcuts-help"
      >
        <h2
          className="text-lg font-display font-bold text-center mb-4"
          style={{ color: "var(--color-text)" }}
        >
          {t("settings.keyboardShortcuts")}
        </h2>

        <div className="flex flex-col gap-1.5">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 py-1 px-1"
            >
              <KeyCapGroup
                caps={s.keyCaps}
                separator={s.keyCaps.length > 2 ? "+" : "/"}
              />
              <span
                className="text-xs font-body text-right flex-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <p
          className="text-[10px] font-body text-center mt-4"
          style={{ color: "var(--color-text-muted)" }}
        >
          Press <KeyCap label="?" /> or <KeyCap label="Esc" /> to close
        </p>
      </div>
    </div>
  );
}
