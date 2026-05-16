import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface UseDialogFocusOptions {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onDismiss?: () => void;
}

function isFocusable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  if (element.hidden) return false;
  return element.offsetWidth > 0 || element.offsetHeight > 0;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    isFocusable,
  );
}

export function useDialogFocus({
  active,
  containerRef,
  initialFocusRef,
  returnFocusRef,
  onDismiss,
}: UseDialogFocusOptions): void {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const container = containerRef.current;
    if (!container) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const returnFocusTarget = returnFocusRef?.current ?? previousFocus;

    const focusInitial = (): void => {
      const target =
        initialFocusRef?.current ?? getFocusableElements(container)[0];
      (target ?? container).focus({ preventScroll: true });
    };

    const frameId = window.requestAnimationFrame(focusInitial);

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && onDismiss) {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === first || !container.contains(activeElement)) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        }
        return;
      }

      if (activeElement === last || !container.contains(activeElement)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.setTimeout(() => {
        if (returnFocusTarget && document.contains(returnFocusTarget)) {
          returnFocusTarget.focus({ preventScroll: true });
        }
      }, 0);
    };
  }, [active, containerRef, initialFocusRef, onDismiss, returnFocusRef]);
}
