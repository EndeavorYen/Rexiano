/**
 * OSMD Cursor-based note highlighting engine.
 *
 * Architecture:
 *   1. After OSMD renders, `buildTimeMap()` iterates the cursor to build
 *      a sorted array of { time, endTime, stepIndex } entries.
 *   2. During playback, `tick(audioTime)` binary-searches the time map,
 *      steps the cursor to the correct position, and applies CSS highlights
 *      to all GraphicalNotes under the cursor.
 *   3. Notes stay highlighted for their full duration (time → endTime).
 *   4. Page flips are handled by OSMD's `followCursor` or the existing
 *      measureWindow logic in SheetMusicPanelOSMD.
 *
 * This replaces the old osmdNoteHighlight.ts which manually walked
 * GraphicSheet.MeasureList and couldn't handle page flips or note durations.
 */

const ACTIVE_CLASS = "osmd-note-active";

export interface CursorTimeEntry {
  /** Playback time in seconds when this cursor step starts */
  time: number;
  /** Playback time in seconds when this cursor step ends (= next step's time, or time + duration) */
  endTime: number;
  /** The cursor step index (0-based) — used to navigate cursor.next() */
  stepIndex: number;
  /** The 0-based measure index for this step */
  measureIndex: number;
}

/**
 * Build a time map by iterating through the entire OSMD cursor.
 * Must be called after osmd.render().
 *
 * @returns Sorted array of cursor step entries with timing info.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildTimeMap(osmd: any): CursorTimeEntry[] {
  const cursor = osmd?.cursor;
  if (!cursor) return [];

  // Get BPM from first source measure
  const sourceMeasures = osmd.Sheet?.SourceMeasures;
  const bpm = sourceMeasures?.[0]?.TempoInBPM || 120;

  cursor.reset();
  const it = cursor.Iterator;
  if (!it) return [];

  const entries: CursorTimeEntry[] = [];
  let stepIndex = 0;

  while (!it.EndReached) {
    const ts = it.currentTimeStamp;
    // RealValue is relative to a whole note (1.0 = whole note)
    // Convert: realValue * 4 = beats, * 60/bpm = seconds
    const time = ts.RealValue * 4 * 60 / bpm;

    // Find the longest note duration at this step
    let maxDuration = 0;
    const voices = it.CurrentVoiceEntries || [];
    for (const ve of voices) {
      for (const note of ve.Notes) {
        if (!note.isRest()) {
          const dur = note.Length.RealValue * 4 * 60 / bpm;
          if (dur > maxDuration) maxDuration = dur;
        }
      }
    }

    entries.push({
      time,
      endTime: time + maxDuration, // Will be refined below
      stepIndex,
      measureIndex: it.CurrentMeasureIndex,
    });

    stepIndex++;
    it.moveToNext();
  }

  // Refine endTime: for each entry, endTime = min(time + duration, nextEntry.time)
  // This prevents overlapping highlights while respecting note duration
  for (let i = 0; i < entries.length; i++) {
    if (i < entries.length - 1) {
      // Don't extend past the next step's start time
      entries[i].endTime = Math.min(entries[i].endTime, entries[i + 1].time);
    }
  }

  // Reset cursor to start for later use
  cursor.reset();

  return entries;
}

/**
 * Clear all osmd-note-active highlights from the container.
 */
export function clearHighlights(container: HTMLElement): void {
  const active = container.querySelectorAll(`.${ACTIVE_CLASS}`);
  active.forEach((el) => el.classList.remove(ACTIVE_CLASS));
}

/**
 * Find the time map entry that should be highlighted at the given audio time.
 * Uses binary search for O(log n) performance.
 *
 * Returns the entry where time ≤ audioTime < endTime, or null.
 */
export function findActiveEntry(
  timeMap: CursorTimeEntry[],
  audioTime: number,
): CursorTimeEntry | null {
  if (timeMap.length === 0) return null;

  // Binary search for the last entry with time ≤ audioTime
  let lo = 0;
  let hi = timeMap.length - 1;
  let result = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (timeMap[mid].time <= audioTime) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (result < 0) return null;

  const entry = timeMap[result];
  // Check if audioTime is within the entry's active duration
  if (audioTime < entry.endTime) {
    return entry;
  }

  return null;
}

/**
 * Navigate the OSMD cursor to a specific step index and highlight
 * all notes under the cursor using CSS classes.
 *
 * @param osmd       The OSMD instance
 * @param entry      The time map entry to highlight
 * @param container  The DOM container for clearing old highlights
 * @param currentStep  Ref to the current cursor step (for efficient navigation)
 * @returns The new current step index
 */
export function highlightAtStep(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  osmd: any,
  entry: CursorTimeEntry,
  container: HTMLElement,
  currentStep: number,
): number {
  clearHighlights(container);

  const cursor = osmd?.cursor;
  if (!cursor) return currentStep;

  // Navigate cursor to the target step
  // If we need to go forward, step forward; if backward, reset and step
  const target = entry.stepIndex;
  if (target < currentStep) {
    cursor.reset();
    for (let i = 0; i < target; i++) {
      cursor.next();
    }
  } else {
    for (let i = currentStep; i < target; i++) {
      cursor.next();
    }
  }

  // Get all graphical notes at this cursor position
  const gNotes = cursor.GNotesUnderCursor() || [];
  for (const gNote of gNotes) {
    const svgEl = gNote.getSVGGElement?.();
    if (svgEl instanceof SVGElement) {
      const heads = svgEl.querySelectorAll(".vf-notehead path");
      if (heads.length > 0) {
        heads.forEach((h: Element) => h.classList.add(ACTIVE_CLASS));
      } else {
        // Fallback: highlight paths/ellipses in the note group
        const paths = svgEl.querySelectorAll("path, ellipse");
        paths.forEach((h: Element) => h.classList.add(ACTIVE_CLASS));
      }
    }
  }

  return target;
}
