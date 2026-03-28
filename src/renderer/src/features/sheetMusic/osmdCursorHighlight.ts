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
 * Build an ordered list of cursor steps with time + SVG element refs.
 *
 * Uses merge-style matching: iterates OSMD cursor steps and the song's
 * notes in parallel (both chronological). For each cursor step, finds
 * the next unmatched ParsedNote with matching MIDI to get its time.
 *
 * @param osmd The OSMD instance (after render)
 * @param song The parsed song (source of truth for note times)
 */
export function buildCursorSteps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  osmd: any,
  song: ParsedSong | null,
): CursorStep[] {
  const cursor = osmd?.cursor;
  if (!cursor || !song) return [];

  // Flatten and sort all song notes by time for merge matching
  const songNotes = song.tracks
    .flatMap((t) => t.notes)
    .sort((a, b) => a.time - b.time || a.midi - b.midi);

  cursor.reset();
  const it = cursor.Iterator;
  if (!it) return [];

  // Estimate the time of the first rendered cursor step to position
  // notePtr near the right region of songNotes (avoids false matches
  // with earlier measures that have the same MIDI pitches).
  const firstBpm = song.tempos[0]?.bpm ?? 120;
  const firstTs = song.timeSignatures[0];
  const firstMeasureIdx = it.CurrentMeasureIndex;
  const secPerMeasure =
    (60 / firstBpm) * (firstTs?.numerator ?? 4) * (4 / (firstTs?.denominator ?? 4));
  const estimatedStartTime = firstMeasureIdx * secPerMeasure;

  // Binary search songNotes for the estimated start time
  let notePtr = 0;
  {
    let lo = 0;
    let hi = songNotes.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      if (songNotes[mid].time < estimatedStartTime - 0.5) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    notePtr = lo;
  }

  const steps: CursorStep[] = [];

  while (!it.EndReached) {
    // Collect MIDI numbers at this cursor step
    const voices = it.CurrentVoiceEntries || [];
    const stepMidis = new Set<number>();
    for (const ve of voices) {
      for (const note of ve.Notes) {
        if (!note.isRest()) {
          stepMidis.add(note.halfTone + 12);
        }
      }
    }

    // Merge-match: advance notePtr to find a song note matching any of
    // this step's MIDI values. Both sequences are chronological.
    let matchedTime = -1;
    let matchedEndTime = -1;
    for (let i = notePtr; i < songNotes.length; i++) {
      if (stepMidis.has(songNotes[i].midi)) {
        matchedTime = songNotes[i].time;
        matchedEndTime = songNotes[i].time + songNotes[i].duration;
        // Advance past all notes at this same time (chord)
        while (notePtr < songNotes.length && songNotes[notePtr].time <= matchedTime + 0.01) {
          notePtr++;
        }
        break;
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
): CursorStep | null {
  if (steps.length === 0 || songTime < 0) return null;

  // Binary search: last step with time ≤ songTime
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

  // Check if the step is still sounding
  if (songTime < steps[result].endTime) return steps[result];

  // Walk backward for polyphonic overlap (long note sustaining past shorter ones)
  for (let i = result - 1; i >= 0; i--) {
    if (steps[i].time <= songTime && songTime < steps[i].endTime) {
      return steps[i];
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
