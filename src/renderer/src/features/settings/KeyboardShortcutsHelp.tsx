import { useEffect, useState, useCallback } from "react";
import {
  onHelpChange,
  getShowHelp,
  setShowHelp,
} from "@renderer/hooks/useKeyboardShortcuts";
import { useTranslation } from "@renderer/i18n/useTranslation";

interface ShortcutEntry {
  /** Key combination displayed in the left column */
  keys: string;
  /** Description — either an i18n key result or a plain string */
  label: string;
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
    { keys: "Space", label: t("settings.shortcut.playPause") },
    { keys: "R", label: t("settings.shortcut.restart") },
    { keys: "\u2190 / \u2192", label: "Seek \u00B15s" },
    { keys: "Shift + \u2190 / \u2192", label: "Seek \u00B115s" },
    {
      keys: "\u2191 / \u2193",
      label:
        t("settings.shortcut.speedUp") +
        " / " +
        t("settings.shortcut.speedDown"),
    },
    {
      keys: "A / B",
      label:
        t("settings.shortcut.loopA") + " / " + t("settings.shortcut.loopB"),
    },
    { keys: "L", label: t("practice.clearLoop") },
    {
      keys: "1 / 2 / 3",
      label:
        t("practice.watch") +
        " / " +
        t("practice.wait") +
        " / " +
        t("practice.free"),
    },
    { keys: "M", label: t("audio.mute") + " / " + t("audio.unmute") },
    { keys: "Ctrl+O", label: "Open file" },
    { keys: "?", label: "Toggle this help" },
    { keys: "Esc", label: t("settings.shortcut.closeBack") },
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
          {shortcuts.map((s) => (
            <div
              key={s.keys}
              className="flex items-center justify-between gap-3 py-1 px-1"
            >
              <kbd
                className="inline-block min-w-[80px] text-center text-[11px] font-mono px-2 py-0.5 rounded"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-surface-alt) 70%, var(--color-surface))",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text)",
                }}
              >
                {s.keys}
              </kbd>
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
          Press <kbd className="font-mono">?</kbd> or{" "}
          <kbd className="font-mono">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
