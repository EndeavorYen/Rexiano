/**
 * OSMD note highlighting — adds/removes CSS glow on note-heads.
 * Each step's highlights persist until the next step is reached.
 */

const ACTIVE_CLASS = "osmd-note-active";

export class HighlightManager {
  private currentElements: Element[] = [];

  /** Highlight notes under the OSMD cursor, replacing any previous highlights. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  highlight(osmd: any): void {
    this.clear();

    const gNotes = osmd?.cursor?.GNotesUnderCursor?.() ?? [];
    for (const gNote of gNotes) {
      // Skip rest notes — they have SVG elements but shouldn't glow
      if (gNote.sourceNote?.isRestFlag) continue;
      const svgEl = gNote.getSVGGElement?.();
      if (svgEl instanceof SVGElement) {
        const heads = svgEl.querySelectorAll(".vf-notehead path");
        const targets =
          heads.length > 0 ? heads : svgEl.querySelectorAll("path, ellipse");
        targets.forEach((el: Element) => {
          el.classList.add(ACTIVE_CLASS);
          this.currentElements.push(el);
        });
      }
    }
  }

  /** Remove all current highlights. */
  clear(): void {
    for (const el of this.currentElements) {
      el.classList.remove(ACTIVE_CLASS);
    }
    this.currentElements = [];
  }
}

