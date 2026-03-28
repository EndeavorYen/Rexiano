/**
 * OSMD note highlighting — time-driven, synced to the playback store.
 *
 * Uses the same time source as falling notes and the piano keyboard:
 * usePlaybackStore.currentTime (written every frame by tickerLoop).
 *
 * After OSMD renders, buildCursorSteps() iterates the cursor and
 * merge-matches each step to ParsedNote.time for accurate timestamps.
 * During playback, findStepAtTime() binary-searches the step list.
 * SVG element refs are cached at build time — no DOM traversal per tick.
 */
import type { ParsedSong } from "@renderer/engines/midi/types";

const ACTIVE_CLASS = "osmd-note-active";

export interface CursorStep {
  /** Song time in seconds (from ParsedNote.time) */
  time: number;
  /** End time: when this step's notes finish sounding */
  endTime: number;
  /** SVG elements to highlight (cached from cursor traversal) */
  svgElements: Element[];
}

/**
 * @param osmd  The OSMD instance (after render)
 * @param song  The parsed song (source of truth for note times)
 * @param pageStartTime  Notes before this time are skipped to avoid
 *   cross-page ambiguity when the same pitch appears in multiple measures.
 */
export function buildCursorSteps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  osmd: any,
  song: ParsedSong | null,
  pageStartTime = 0,
): CursorStep[] {
  const cursor = osmd?.cursor;
  if (!cursor || !song) return [];

  // Build a lookup: for each MIDI number, a sorted list of {time, duration}
  // This allows per-step matching without sequential notePtr coupling.
  const notesByMidi = new Map<number, { time: number; duration: number }[]>();
  for (const track of song.tracks) {
    for (const note of track.notes) {
      let list = notesByMidi.get(note.midi);
      if (!list) {
        list = [];
        notesByMidi.set(note.midi, list);
      }
      list.push({ time: note.time, duration: note.duration });
    }
  }
  for (const list of notesByMidi.values()) {
    list.sort((a, b) => a.time - b.time);
  }

  cursor.reset();
  const it = cursor.Iterator;
  if (!it) return [];

  // Start matching from just before the page's first note time.
  // This prevents matching notes from earlier pages when the same
  // pitch appears in multiple measures (e.g. C4 in m.1 and m.5).
  let lastMatchedTime = pageStartTime > 0 ? pageStartTime - 0.01 : -1;

  const steps: CursorStep[] = [];

  while (!it.EndReached) {
    const voices = it.CurrentVoiceEntries || [];
    const stepMidis: number[] = [];
    for (const ve of voices) {
      for (const note of ve.Notes) {
        if (!note.isRest()) {
          stepMidis.push(note.halfTone + 12);
        }
      }
    }

    // Find the earliest note time after lastMatchedTime for any MIDI in this step
    let matchedTime = -1;
    let matchedEndTime = -1;
    for (const midi of stepMidis) {
      const list = notesByMidi.get(midi);
      if (!list) continue;
      // Binary search for the first note with time > lastMatchedTime
      let lo = 0;
      let hi = list.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (list[mid].time > lastMatchedTime + 0.001) {
          found = mid;
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }
      if (found >= 0) {
        const candidate = list[found];
        if (matchedTime < 0 || candidate.time < matchedTime) {
          matchedTime = candidate.time;
          matchedEndTime = candidate.time + candidate.duration;
        }
      }
    }

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

    // Only include steps with a valid time match and SVG elements
    if (matchedTime >= 0 && svgElements.length > 0) {
      steps.push({ time: matchedTime, endTime: matchedEndTime, svgElements });
      lastMatchedTime = matchedTime;
    }

    cursor.next();
  }

  cursor.reset();
  return steps;
}

/**
 * Find the step to highlight at a given song time.
 * Binary search for the last step with time ≤ songTime that hasn't ended.
 */
export function findStepAtTime(
  steps: CursorStep[],
  songTime: number,
): { step: CursorStep; index: number } | null {
  if (steps.length === 0 || songTime < 0) return null;

  let lo = 0;
  let hi = steps.length - 1;
  let result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (steps[mid].time <= songTime) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (result < 0) return null;

  if (songTime < steps[result].endTime)
    return { step: steps[result], index: result };

  // Walk backward for polyphonic overlap
  for (let i = result - 1; i >= 0; i--) {
    if (steps[i].time <= songTime && songTime < steps[i].endTime) {
      return { step: steps[i], index: i };
    }
  }

  return null;
}

export function clearHighlights(container: HTMLElement): void {
  const active = container.querySelectorAll(`.${ACTIVE_CLASS}`);
  active.forEach((el) => el.classList.remove(ACTIVE_CLASS));
}

/** Clears prevStep's elements directly (O(step-size)) instead of querySelectorAll (O(DOM)). */
export function highlightStep(
  step: CursorStep,
  prevStep: CursorStep | null,
): void {
  if (prevStep) {
    for (const el of prevStep.svgElements) {
      el.classList.remove(ACTIVE_CLASS);
    }
  }
  for (const el of step.svgElements) {
    el.classList.add(ACTIVE_CLASS);
  }
}
