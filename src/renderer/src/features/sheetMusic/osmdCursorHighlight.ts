/**
 * OSMD Cursor-based note highlighting engine.
 *
 * Architecture:
 *   1. After OSMD renders, `buildTimeMap()` iterates the cursor and matches
 *      each step to the closest ParsedNote by MIDI number + time proximity.
 *      This gives us song-time (seconds) that is on the same clock as
 *      AudioScheduler.getCurrentTime().
 *   2. During playback, `findActiveEntry(audioTime)` binary-searches the
 *      time map to find the current highlight target.
 *   3. `highlightAtStep()` navigates the cursor and applies CSS classes
 *      to GNotesUnderCursor() SVG elements.
 *   4. Notes stay highlighted for their full duration (time → endTime).
 *
 * Why not use OSMD's own RealValue→seconds formula?
 *   `timestamp.RealValue * 4 * 60 / bpm` assumes fixed BPM and introduces
 *   drift vs AudioScheduler's actual song time. Matching to ParsedNote.time
 *   guarantees the highlight clock matches the audio clock exactly.
 */
import type { ParsedSong, ParsedNote } from "@renderer/engines/midi/types";

const ACTIVE_CLASS = "osmd-note-active";

export interface CursorTimeEntry {
  /** Playback time in seconds when this cursor step starts */
  time: number;
  /** Playback time in seconds when this cursor step ends */
  endTime: number;
  /** The cursor step index (0-based) — used to navigate cursor.next() */
  stepIndex: number;
  /** The 0-based measure index for this step */
  measureIndex: number;
}

/**
 * Build a sorted list of song notes for time matching.
 * Notes are sorted by time, then midi.
 */
function buildNoteIndex(song: ParsedSong): ParsedNote[] {
  const all: ParsedNote[] = [];
  for (const track of song.tracks) {
    for (const note of track.notes) {
      all.push(note);
    }
  }
  all.sort((a, b) => a.time - b.time || a.midi - b.midi);
  return all;
}

/**
 * Find the closest ParsedNote matching a given MIDI number near a beat-estimated time.
 * Returns the note's time and duration, or null if no match.
 */
function matchNote(
  noteIndex: ParsedNote[],
  midi: number,
  estimatedTime: number,
  tolerance: number,
): { time: number; duration: number } | null {
  // Binary search for approximate position
  let lo = 0;
  let hi = noteIndex.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (noteIndex[mid].time < estimatedTime - tolerance) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Scan forward from lo to find best match
  let bestDist = Infinity;
  let bestNote: ParsedNote | null = null;
  for (let i = lo; i < noteIndex.length; i++) {
    const n = noteIndex[i];
    if (n.time > estimatedTime + tolerance) break;
    if (n.midi === midi) {
      const dist = Math.abs(n.time - estimatedTime);
      if (dist < bestDist) {
        bestDist = dist;
        bestNote = n;
      }
    }
  }

  return bestNote ? { time: bestNote.time, duration: bestNote.duration } : null;
}

/**
 * Build a time map by iterating through the OSMD cursor and matching
 * each step to ParsedNote times for accurate audio synchronization.
 *
 * @param osmd The OSMD instance (after render)
 * @param song The parsed song (source of truth for note times)
 * @returns Sorted array of cursor step entries with timing info.
 */
export function buildTimeMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  osmd: any,
  song: ParsedSong | null,
): CursorTimeEntry[] {
  const cursor = osmd?.cursor;
  if (!cursor || !song) return [];

  const noteIndex = buildNoteIndex(song);
  const sourceMeasures = osmd.Sheet?.SourceMeasures;
  const fallbackBpm = sourceMeasures?.[0]?.TempoInBPM || 120;

  cursor.reset();
  const it = cursor.Iterator;
  if (!it) return [];

  const entries: CursorTimeEntry[] = [];
  let stepIndex = 0;

  while (!it.EndReached) {
    const ts = it.currentTimeStamp;
    // Estimated time using fixed BPM (fallback if no note match)
    const estimatedTime = ts.RealValue * 4 * 60 / fallbackBpm;

    // Collect all notes at this cursor step
    const voices = it.CurrentVoiceEntries || [];
    let bestTime = estimatedTime;
    let maxDuration = 0;
    let matched = false;

    for (const ve of voices) {
      for (const note of ve.Notes) {
        const dur = note.Length.RealValue * 4 * 60 / fallbackBpm;
        if (dur > maxDuration) maxDuration = dur;

        if (!note.isRest()) {
          // halfTone is MIDI-relative (middle C = 60 in OSMD when +12 offset)
          const midi = note.halfTone + 12;
          const match = matchNote(noteIndex, midi, estimatedTime, 0.5);
          if (match) {
            bestTime = match.time;
            if (match.duration > maxDuration) maxDuration = match.duration;
            matched = true;
          }
        }
      }
    }

    // For rest-only steps without a note match, use estimated time
    // but ensure duration is at least the rest's rhythmic value
    if (!matched && maxDuration === 0) {
      maxDuration = 0.25; // minimum quarter-beat fallback
    }

    entries.push({
      time: bestTime,
      endTime: bestTime + maxDuration,
      stepIndex,
      measureIndex: it.CurrentMeasureIndex,
    });

    stepIndex++;
    it.moveToNext();
  }

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
 * Uses binary search + backward walk for polyphonic overlap handling.
 */
export function findActiveEntry(
  timeMap: CursorTimeEntry[],
  audioTime: number,
): CursorTimeEntry | null {
  if (timeMap.length === 0) return null;

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

  // Walk backwards to find a still-active entry (handles polyphonic overlap)
  for (let i = result; i >= 0; i--) {
    if (timeMap[i].time <= audioTime && audioTime < timeMap[i].endTime) {
      return timeMap[i];
    }
  }

  return null;
}

/**
 * Navigate the OSMD cursor to a specific step and highlight notes via CSS.
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

  return target;
}
