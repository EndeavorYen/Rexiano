/**
 * Minimal CSS glow helpers for OSMD note highlighting.
 * The cursor positioning is handled by OSMD's native cursor + followCursor.
 * These functions just add/remove the accent glow on note-heads.
 */

const ACTIVE_CLASS = "osmd-note-active";

/**
 * Add glow highlight to all graphical notes under the OSMD cursor.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function highlightNotesUnderCursor(osmd: any): void {
  const gNotes = osmd?.cursor?.GNotesUnderCursor?.() ?? [];
  for (const gNote of gNotes) {
    const svgEl = gNote.getSVGGElement?.();
    if (svgEl instanceof SVGElement) {
      const heads = svgEl.querySelectorAll(".vf-notehead path");
      if (heads.length > 0) {
        heads.forEach((h: Element) => h.classList.add(ACTIVE_CLASS));
      } else {
        svgEl.querySelectorAll("path, ellipse").forEach((h: Element) =>
          h.classList.add(ACTIVE_CLASS),
        );
      }
    }
  }
}

export function clearHighlights(container: HTMLElement): void {
  container
    .querySelectorAll(`.${ACTIVE_CLASS}`)
    .forEach((el) => el.classList.remove(ACTIVE_CLASS));
}
