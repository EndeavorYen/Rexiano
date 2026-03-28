/**
 * OSMD Cursor-based note highlighting — event-driven architecture.
 *
 * After OSMD renders, buildCursorSteps() iterates the cursor to build
 * a list of { midis, svgElements } for each step. During playback,
 * activeNotes (from tickerLoop) are matched against the next expected
 * step's MIDI set. When matched, highlights move forward.
 *
 * This guarantees zero drift because activeNotes comes from the same
 * effectiveTime that drives falling notes and the piano keyboard.
 */

const ACTIVE_CLASS = "osmd-note-active";

export interface CursorStep {
  /** MIDI note numbers at this cursor position (sorted for comparison) */
  midis: number[];
  /** Key string for fast comparison (e.g. "60,64,67") */
  midiKey: string;
  /** SVG elements to highlight (collected during cursor traversal) */
  svgElements: Element[];
}

/**
 * Build an ordered list of cursor steps with their MIDI content and SVG elements.
 * Must be called after osmd.render().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildCursorSteps(osmd: any): CursorStep[] {
  const cursor = osmd?.cursor;
  if (!cursor) return [];

  cursor.reset();
  const it = cursor.Iterator;
  if (!it) return [];

  const steps: CursorStep[] = [];

  while (!it.EndReached) {
    const voices = it.CurrentVoiceEntries || [];
    const midis: number[] = [];
    for (const ve of voices) {
      for (const note of ve.Notes) {
        if (!note.isRest()) {
          midis.push(note.halfTone + 12);
        }
      }
    }
    midis.sort((a, b) => a - b);

    // Collect SVG elements at this cursor position
    const gNotes = cursor.GNotesUnderCursor() || [];
    const svgElements: Element[] = [];
    for (const gNote of gNotes) {
      const svgEl = gNote.getSVGGElement?.();
      if (svgEl instanceof SVGElement) {
        const heads = svgEl.querySelectorAll(".vf-notehead path");
        if (heads.length > 0) {
          heads.forEach((h: Element) => svgElements.push(h));
        } else {
          const paths = svgEl.querySelectorAll("path, ellipse");
          paths.forEach((h: Element) => svgElements.push(h));
        }
      }
    }

    steps.push({
      midis,
      midiKey: midis.join(","),
      svgElements,
    });

    cursor.next();
  }

  cursor.reset();
  return steps;
}

/**
 * Clear all osmd-note-active highlights from the container.
 */
export function clearHighlights(container: HTMLElement): void {
  const active = container.querySelectorAll(`.${ACTIVE_CLASS}`);
  active.forEach((el) => el.classList.remove(ACTIVE_CLASS));
}

/**
 * Highlight a specific cursor step's SVG elements.
 */
export function highlightStep(
  step: CursorStep,
  container: HTMLElement,
): void {
  clearHighlights(container);
  for (const el of step.svgElements) {
    el.classList.add(ACTIVE_CLASS);
  }
}
