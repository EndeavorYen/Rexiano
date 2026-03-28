/**
 * OSMD note highlighting with per-note duration tracking.
 * Each highlighted note has its own endTime based on its actual duration.
 */

const ACTIVE_CLASS = "osmd-note-active";

interface ActiveHighlight {
  element: Element;
  endTime: number;
}

export class HighlightManager {
  private active: ActiveHighlight[] = [];

  /** Remove highlights whose endTime has passed. */
  tick(currentTime: number): void {
    this.active = this.active.filter((h) => {
      if (currentTime >= h.endTime) {
        h.element.classList.remove(ACTIVE_CLASS);
        return false;
      }
      return true;
    });
  }

  /**
   * Highlight notes under the OSMD cursor, each with its own endTime
   * derived from the matching ParsedNote's duration.
   *
   * @param osmd    The OSMD instance
   * @param endTimeByMidi  Map from MIDI number → endTime (seconds) for
   *   each note at this cursor step. Notes not in the map use defaultEndTime.
   * @param defaultEndTime  Fallback endTime for unmatched notes.
   */
  addFromCursor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    osmd: any,
    endTimeByMidi: Map<number, number>,
    defaultEndTime: number,
  ): void {
    const gNotes = osmd?.cursor?.GNotesUnderCursor?.() ?? [];

    for (const gNote of gNotes) {
      // Get MIDI from the graphical note's source
      const midi = gNote.sourceNote?.halfTone
        ? gNote.sourceNote.halfTone + 12
        : -1;
      const endTime = endTimeByMidi.get(midi) ?? defaultEndTime;

      const svgEl = gNote.getSVGGElement?.();
      if (svgEl instanceof SVGElement) {
        const heads = svgEl.querySelectorAll(".vf-notehead path");
        const targets = heads.length > 0 ? heads : svgEl.querySelectorAll("path, ellipse");
        targets.forEach((el: Element) => {
          // Don't add duplicate highlight for the same element
          if (!el.classList.contains(ACTIVE_CLASS)) {
            el.classList.add(ACTIVE_CLASS);
            this.active.push({ element: el, endTime });
          }
        });
      }
    }
  }

  clear(): void {
    for (const h of this.active) {
      h.element.classList.remove(ACTIVE_CLASS);
    }
    this.active = [];
  }

  reset(): void {
    this.clear();
  }
}
