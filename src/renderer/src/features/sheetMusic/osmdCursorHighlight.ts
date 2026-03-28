/**
 * OSMD Cursor-based note highlighting — event-driven architecture.
 *
 * Instead of calculating time independently, this module receives
 * activeNotes (Set<number> of MIDI numbers) from the same tickerLoop
 * that drives falling notes and the piano keyboard.
 *
 * The OSMD cursor steps forward on each note change, and CSS classes
 * are applied to the SVG note-heads under the cursor.
 *
 * This guarantees zero drift: audio, falling notes, keyboard, and
 * sheet music highlights all derive from the same effectiveTime
 * computed once per frame in tickerLoop.
 */

const ACTIVE_CLASS = "osmd-note-active";

/**
 * Clear all osmd-note-active highlights from the container.
 */
export function clearHighlights(container: HTMLElement): void {
  const active = container.querySelectorAll(`.${ACTIVE_CLASS}`);
  active.forEach((el) => el.classList.remove(ACTIVE_CLASS));
}

/**
 * Advance the OSMD cursor by one step and highlight all notes under it.
 *
 * @param osmd       The OSMD instance
 * @param container  DOM container for clearing old highlights
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function advanceAndHighlight(osmd: any, container: HTMLElement): void {
  clearHighlights(container);

  const cursor = osmd?.cursor;
  if (!cursor) return;

  cursor.next();

  // If cursor reached the end, nothing to highlight
  if (cursor.Iterator?.EndReached) return;

  const gNotes = cursor.GNotesUnderCursor() || [];
  for (const gNote of gNotes) {
    const svgEl = gNote.getSVGGElement?.();
    if (svgEl instanceof SVGElement) {
      const heads = svgEl.querySelectorAll(".vf-notehead path");
      if (heads.length > 0) {
        heads.forEach((h: Element) => h.classList.add(ACTIVE_CLASS));
      } else {
        const paths = svgEl.querySelectorAll("path, ellipse");
        paths.forEach((h: Element) => h.classList.add(ACTIVE_CLASS));
      }
    }
  }
}

/**
 * Reset the OSMD cursor to the beginning and clear highlights.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resetCursor(osmd: any, container: HTMLElement): void {
  clearHighlights(container);
  osmd?.cursor?.reset();
}
