import { useEffect } from "react";

const LIBRARY_RETURN_FOCUS_KEY = "rexiano-library-return-focus";

export function rememberLibraryReturnFocus(testId: string): void {
  try {
    sessionStorage.setItem(LIBRARY_RETURN_FOCUS_KEY, testId);
  } catch {
    // Session storage is optional; the visible workflow still remains usable.
  }
}

export function useLibraryReturnFocus(): void {
  useEffect(() => {
    let returnFocusTestId: string | null = null;
    try {
      returnFocusTestId = sessionStorage.getItem(LIBRARY_RETURN_FOCUS_KEY);
    } catch {
      return;
    }
    if (!returnFocusTestId) return;

    let frameId = 0;
    let attempts = 0;
    let stableFrames = 0;
    const restoreFocus = (): void => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>("[data-testid]"),
      ).find((element) => element.dataset.testid === returnFocusTestId);
      attempts += 1;

      if (target) {
        if (document.activeElement !== target) {
          target.focus({ preventScroll: true });
          stableFrames = 0;
        } else {
          stableFrames += 1;
        }

        if (stableFrames >= 2) {
          target.scrollIntoView({ block: "nearest", inline: "nearest" });
          try {
            sessionStorage.removeItem(LIBRARY_RETURN_FOCUS_KEY);
          } catch {
            // Focus restoration succeeded.
          }
          return;
        }
      }

      if (attempts < 600) frameId = window.requestAnimationFrame(restoreFocus);
    };
    frameId = window.requestAnimationFrame(restoreFocus);
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);
}
