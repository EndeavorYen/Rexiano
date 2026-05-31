import type { Page } from "@playwright/test";

export interface ViewportAuditIssue {
  testId: string | null;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  right: number;
  bottom: number;
  vw: number;
  vh: number;
  scrollContainerTestId?: string | null;
  scrollContainerLabel?: string;
}

export interface ViewportAuditResult {
  viewportOverflow: ViewportAuditIssue[];
  scrollContainedOffscreen: ViewportAuditIssue[];
}

export async function collectViewportAudit(
  page: Page,
): Promise<ViewportAuditResult> {
  return page.evaluate(collectViewportAuditInPage);
}

function collectViewportAuditInPage(): ViewportAuditResult {
  const interactiveSelector = [
    "button",
    "input",
    "select",
    "textarea",
    "[role='button']",
    "[role='dialog']",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");
  const margin = 1;
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  function rectToIssue(
    element: Element,
    rect: DOMRect,
    scrollContainer?: Element | null,
  ): ViewportAuditIssue {
    return {
      testId: element.getAttribute("data-testid"),
      label:
        element.getAttribute("aria-label") ??
        element.getAttribute("title") ??
        element.textContent?.replace(/\s+/g, " ").trim()?.slice(0, 80) ??
        element.tagName.toLowerCase(),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
      right: Math.round(rect.right),
      bottom: Math.round(rect.bottom),
      vw: viewport.width,
      vh: viewport.height,
      scrollContainerTestId: scrollContainer?.getAttribute("data-testid"),
      scrollContainerLabel: scrollContainer
        ? (scrollContainer.getAttribute("aria-label") ??
          scrollContainer.getAttribute("title") ??
          scrollContainer.textContent
            ?.replace(/\s+/g, " ")
            .trim()
            ?.slice(0, 80) ??
          scrollContainer.tagName.toLowerCase())
        : undefined,
    };
  }

  function isRendered(element: Element, rect: DOMRect): boolean {
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  }

  function isScrollableValue(value: string): boolean {
    return value === "auto" || value === "scroll" || value === "overlay";
  }

  function outsideViewport(rect: DOMRect): boolean {
    return (
      rect.x < -margin ||
      rect.y < -margin ||
      rect.right > viewport.width + margin ||
      rect.bottom > viewport.height + margin
    );
  }

  function fitsInViewport(rect: DOMRect): boolean {
    return (
      rect.x >= -margin &&
      rect.y >= -margin &&
      rect.right <= viewport.width + margin &&
      rect.bottom <= viewport.height + margin
    );
  }

  function findReachableScrollContainer(
    element: Element,
    rect: DOMRect,
  ): Element | null {
    let parent = element.parentElement;
    while (
      parent &&
      parent !== document.body &&
      parent !== document.documentElement
    ) {
      const style = window.getComputedStyle(parent);
      const canScrollY =
        isScrollableValue(style.overflowY) &&
        parent.scrollHeight > parent.clientHeight + margin;
      const canScrollX =
        isScrollableValue(style.overflowX) &&
        parent.scrollWidth > parent.clientWidth + margin;

      if (canScrollY || canScrollX) {
        const parentRect = parent.getBoundingClientRect();
        const hiddenByScrollport =
          (canScrollY &&
            (rect.y < parentRect.y - margin ||
              rect.bottom > parentRect.bottom + margin)) ||
          (canScrollX &&
            (rect.x < parentRect.x - margin ||
              rect.right > parentRect.right + margin));

        if (hiddenByScrollport && fitsInViewport(parentRect)) {
          return parent;
        }
      }

      parent = parent.parentElement;
    }

    return null;
  }

  const viewportOverflow: ViewportAuditIssue[] = [];
  const scrollContainedOffscreen: ViewportAuditIssue[] = [];

  for (const element of Array.from(
    document.querySelectorAll(interactiveSelector),
  )) {
    const rect = element.getBoundingClientRect();
    if (!isRendered(element, rect)) {
      continue;
    }

    const scrollContainer = findReachableScrollContainer(element, rect);
    if (scrollContainer) {
      scrollContainedOffscreen.push(
        rectToIssue(element, rect, scrollContainer),
      );
      continue;
    }

    if (outsideViewport(rect)) {
      viewportOverflow.push(rectToIssue(element, rect));
    }
  }

  return { viewportOverflow, scrollContainedOffscreen };
}
