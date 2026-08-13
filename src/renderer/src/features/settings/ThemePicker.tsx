import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import { themes, type ThemeId } from "@renderer/themes/tokens";
import { useTranslation } from "@renderer/i18n/useTranslation";
import {
  getThemePickerNavigationTarget,
  themePickerThemeIds,
} from "./themePickerKeyboard";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function ThemePicker(): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const currentId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [activeId, setActiveId] = useState<ThemeId>(currentId);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef(new Map<ThemeId, HTMLButtonElement>());
  const popupId = `theme-picker-${useId().replaceAll(":", "")}`;

  // First-visit pulse to draw attention to theme picker
  const [isFirstVisit] = useState(() => {
    try {
      return !localStorage.getItem("rexiano-theme-picker-seen");
    } catch {
      return false;
    }
  });

  const markSeen = useCallback(() => {
    if (!isFirstVisit) return;
    try {
      localStorage.setItem("rexiano-theme-picker-seen", "1");
    } catch {
      // The picker remains fully usable without persistence.
    }
  }, [isFirstVisit]);

  const restoreTriggerFocus = useCallback(() => {
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  const closeAndRestoreFocus = useCallback(() => {
    setOpen(false);
    restoreTriggerFocus();
  }, [restoreTriggerFocus]);

  const handleOpen = useCallback(() => {
    markSeen();
    if (open) {
      closeAndRestoreFocus();
      return;
    }
    setActiveId(currentId);
    setOpen(true);
  }, [closeAndRestoreFocus, currentId, markSeen, open]);

  useEffect(() => {
    if (!open) return;
    const frameId = window.requestAnimationFrame(() => {
      optionRefs.current.get(activeId)?.focus();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [activeId, open]);

  // Close on outside click and return to the single popup trigger.
  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent): void => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        closeAndRestoreFocus();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [closeAndRestoreFocus, open]);

  const handleMenuKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeAndRestoreFocus();
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const trigger = triggerRef.current;
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>(focusableSelector),
        ).filter(
          (element) =>
            (element.offsetWidth > 0 || element.offsetHeight > 0) &&
            (!popoverRef.current?.contains(element) || element === trigger),
        );
        const triggerIndex = trigger ? focusable.indexOf(trigger) : -1;
        const destination = event.shiftKey
          ? focusable[triggerIndex - 1]
          : focusable[triggerIndex + 1];
        setOpen(false);
        window.setTimeout(() => destination?.focus(), 0);
        return;
      }

      const nextId = getThemePickerNavigationTarget(activeId, event.key);
      if (!nextId) return;
      event.preventDefault();
      setActiveId(nextId);
      optionRefs.current.get(nextId)?.focus();
    },
    [activeId, closeAndRestoreFocus],
  );

  return (
    <div className="relative" ref={popoverRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors cursor-pointer ${isFirstVisit ? "animate-gentle-pulse" : ""}`}
        style={{ background: "var(--color-surface-alt)" }}
        aria-label={t("settings.changeTheme")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={popupId}
        title={t("settings.changeTheme")}
        data-testid="theme-picker-trigger"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="8"
            cy="8"
            r="3"
            stroke="var(--color-text-muted)"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
            stroke="var(--color-text-muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          id={popupId}
          role="menu"
          aria-label={t("settings.chooseTheme")}
          onKeyDown={handleMenuKeyDown}
          className="absolute bottom-full mb-2 right-0 flex gap-2 p-2 rounded-lg shadow-lg"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          {themePickerThemeIds.map((id) => (
            <button
              key={id}
              ref={(element) => {
                if (element) optionRefs.current.set(id, element);
                else optionRefs.current.delete(id);
              }}
              type="button"
              role="menuitemradio"
              aria-label={themes[id].label}
              aria-checked={id === currentId}
              tabIndex={id === activeId ? 0 : -1}
              onClick={() => {
                setTheme(id);
                closeAndRestoreFocus();
              }}
              className="w-7 h-7 rounded-full relative cursor-pointer transition-transform hover:scale-110"
              style={{
                background: themes[id].dot,
                boxShadow:
                  id === currentId
                    ? "0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-accent)"
                    : "none",
              }}
              title={themes[id].label}
            >
              {id === currentId && (
                <svg
                  className="absolute inset-0 m-auto"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="var(--color-on-accent)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
