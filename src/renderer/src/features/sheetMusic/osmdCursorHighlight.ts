/**
 * OSMD note highlighting with duration-aware sustain.
 *
 * Tracks active highlights with their end times so that long notes
 * (whole notes, half notes) stay highlighted even when the cursor
 * advances past them to shorter notes in another voice.
 */

const ACTIVE_CLASS = "osmd-note-active";

interface ActiveHighlight {
  elements: Element[];
  endTime: number;
}

/** Manages highlight state: adds new highlights, removes expired ones. */
export class HighlightManager {
  private active: ActiveHighlight[] = [];

  /** Remove highlights whose endTime has passed. */
  tick(currentTime: number): void {
    this.active = this.active.filter((h) => {
      if (currentTime >= h.endTime) {
        for (const el of h.elements) el.classList.remove(ACTIVE_CLASS);
        return false;
      }
      return true;
    });
  }

  /** Add highlights for all notes under the OSMD cursor. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addFromCursor(osmd: any, endTime: number): void {
    const gNotes = osmd?.cursor?.GNotesUnderCursor?.() ?? [];
    const elements: Element[] = [];

    for (const gNote of gNotes) {
      const svgEl = gNote.getSVGGElement?.();
      if (svgEl instanceof SVGElement) {
        const heads = svgEl.querySelectorAll(".vf-notehead path");
        if (heads.length > 0) {
          heads.forEach((h: Element) => {
            h.classList.add(ACTIVE_CLASS);
            elements.push(h);
          });
        } else {
          svgEl.querySelectorAll("path, ellipse").forEach((h: Element) => {
            h.classList.add(ACTIVE_CLASS);
            elements.push(h);
          });
        }
      }
    }

    if (elements.length > 0) {
      this.active.push({ elements, endTime });
    }
  }

  /** Clear all highlights immediately. */
  clear(): void {
    for (const h of this.active) {
      for (const el of h.elements) el.classList.remove(ACTIVE_CLASS);
    }
    this.active = [];
  }

  /** Reset for new playback. */
  reset(): void {
    this.clear();
  }
}
