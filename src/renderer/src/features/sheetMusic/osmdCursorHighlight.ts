/**
 * OSMD note highlighting — noteKey→SVG direct lookup.
 *
 * After osmd.render(), buildCursorMaps() walks all cursor steps ONCE and:
 *   1. Determines each step's time (same binary-search as old buildStepTimes)
 *   2. Maps each graphical note to its ParsedNote via (midi, stepTime) matching
 *   3. Builds Map<noteKey, SVGElement[]> for O(1) highlight lookup
 *
 * During playback, highlightByNoteKeys() receives the same activeNoteKeys
 * that NoteRenderer produces, giving O(1) per-note highlight.
 */

import type { ParsedSong } from "@renderer/engines/midi/types";
import type { StepTiming } from "./SheetMusicPanelOSMD";

const ACTIVE_CLASS = "osmd-note-active";

/**
 * Same noteKey format as NoteRenderer — must stay in sync.
 * Uses microsecond-rounded time to avoid float instability.
 */
function noteKey(trackIdx: number, midi: number, time: number): string {
  return `${trackIdx}:${midi}:${Math.round(time * 1e6)}`;
}

export interface CursorMaps {
  stepTimes: StepTiming[];
  noteKeyMap: Map<string, Element[]>;
}

/**
 * Single-pass cursor walk that builds both stepTimes and noteKey→SVG map.
 *
 * For each cursor step:
 *   1. Determine step time via per-MIDI binary search (from ParsedNote.time)
 *   2. For each graphical note, find the ParsedNote at (midi, ~stepTime)
 *   3. Build noteKey → SVG element mapping
 *
 * Must be called after osmd.render() when SVG is fresh.
 */
export function buildCursorMaps(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  osmd: any,
  song: ParsedSong,
): CursorMaps {
  const stepTimes: StepTiming[] = [];
  const noteKeyMap = new Map<string, Element[]>();
  const cursor = osmd?.cursor;
  if (!cursor) return { stepTimes, noteKeyMap };

  // Build per-MIDI sorted time arrays for step-time binary search
  const notesByMidi = new Map<number, number[]>();
  for (const track of song.tracks) {
    for (const note of track.notes) {
      let list = notesByMidi.get(note.midi);
      if (!list) {
        list = [];
        notesByMidi.set(note.midi, list);
      }
      list.push(note.time);
    }
  }
  for (const list of notesByMidi.values()) {
    list.sort((a, b) => a - b);
  }

  // Build per-(trackIdx, midi) sorted time arrays for noteKey matching
  const notesByTrackMidi = new Map<string, number[]>();
  for (let trackIdx = 0; trackIdx < song.tracks.length; trackIdx++) {
    for (const note of song.tracks[trackIdx].notes) {
      const key = `${trackIdx}:${note.midi}`;
      let list = notesByTrackMidi.get(key);
      if (!list) {
        list = [];
        notesByTrackMidi.set(key, list);
      }
      list.push(note.time);
    }
  }
  for (const list of notesByTrackMidi.values()) {
    list.sort((a, b) => a - b);
  }

  cursor.reset();
  const it = cursor.Iterator;
  if (!it) return { stepTimes, noteKeyMap };

  let lastStepTime = -1;

  while (!it.EndReached) {
    // ── Step 1: Determine step time (same logic as old buildStepTimes) ──
    const voices = it.CurrentVoiceEntries || [];
    let bestStepTime = Infinity;

    for (const ve of voices) {
      for (const note of ve.Notes) {
        if (note.isRest()) continue;
        const midi = note.halfTone + 12;
        const list = notesByMidi.get(midi);
        if (!list) continue;
        let lo = 0;
        let hi = list.length - 1;
        let found = -1;
        while (lo <= hi) {
          const mid = (lo + hi) >>> 1;
          if (list[mid] > lastStepTime + 0.001) {
            found = mid;
            hi = mid - 1;
          } else {
            lo = mid + 1;
          }
        }
        if (found >= 0 && list[found] < bestStepTime) {
          bestStepTime = list[found];
        }
      }
    }

    const stepTime =
      bestStepTime < Infinity ? bestStepTime : lastStepTime + 0.01;
    stepTimes.push({ time: stepTime });
    lastStepTime = stepTime;

    // ── Step 2: Map each graphical note to its ParsedNote via (midi, stepTime) ──
    const gNotes = cursor.GNotesUnderCursor?.() ?? [];

    for (const gNote of gNotes) {
      const srcNote = gNote.sourceNote;
      if (!srcNote || srcNote.isRestFlag) continue;

      const midi = srcNote.halfTone + 12;

      // Find the ParsedNote closest to stepTime for this MIDI across all tracks
      let matchedKey: string | null = null;
      let closestDist = Infinity;

      for (let trackIdx = 0; trackIdx < song.tracks.length; trackIdx++) {
        const tmKey = `${trackIdx}:${midi}`;
        const list = notesByTrackMidi.get(tmKey);
        if (!list || list.length === 0) continue;

        // Binary search for closest time to stepTime
        let lo = 0;
        let hi = list.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          if (list[mid] < stepTime - 0.001) {
            lo = mid + 1;
          } else {
            hi = mid;
          }
        }

        // Check lo and lo-1 for closest match
        for (const idx of [lo - 1, lo, lo + 1]) {
          if (idx < 0 || idx >= list.length) continue;
          const dist = Math.abs(list[idx] - stepTime);
          if (dist < closestDist) {
            closestDist = dist;
            matchedKey = noteKey(trackIdx, midi, list[idx]);
          }
        }
      }

      // Only accept matches within 50ms tolerance
      if (matchedKey && closestDist < 0.05) {
        const svgEl = gNote.getSVGGElement?.();
        if (svgEl instanceof SVGElement) {
          const heads = svgEl.querySelectorAll(".vf-notehead path");
          const targets =
            heads.length > 0
              ? Array.from(heads)
              : Array.from(svgEl.querySelectorAll("path, ellipse"));

          if (targets.length > 0) {
            const existing = noteKeyMap.get(matchedKey);
            if (existing) {
              existing.push(...targets);
            } else {
              noteKeyMap.set(matchedKey, targets);
            }
          }
        }
      }
    }

    cursor.next();
  }

  cursor.reset();
  return { stepTimes, noteKeyMap };
}

export class HighlightManager {
  private currentElements: Element[] = [];

  /** Highlight notes by noteKey lookup — the primary method. */
  highlightByNoteKeys(
    activeKeys: Set<string>,
    noteKeyMap: Map<string, Element[]>,
  ): void {
    this.clear();

    for (const key of activeKeys) {
      const elements = noteKeyMap.get(key);
      if (!elements) continue;
      for (const el of elements) {
        el.classList.add(ACTIVE_CLASS);
        this.currentElements.push(el);
      }
    }
  }

  /**
   * Auto-scroll to bring the first highlighted element into view.
   * Called after highlightByNoteKeys when new notes appear.
   */
  scrollToActive(container: HTMLElement): void {
    if (this.currentElements.length === 0) return;
    const el = this.currentElements[0];
    if (!(el instanceof HTMLElement || el instanceof SVGElement)) return;

    const rect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Only scroll if the note is outside the visible area
    if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
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
