import type { ParsedNote } from '@renderer/engines/midi/types'

export interface Viewport {
  /** Canvas width in pixels */
  width: number
  /** Canvas height in pixels */
  height: number
  /** Pixels per second (vertical zoom) */
  pps: number
  /** Current playback time in seconds */
  currentTime: number
}

/**
 * Convert a note's start time to a screen Y coordinate.
 *
 * Coordinate system:
 * - hitLineY is at canvas bottom (where notes "arrive" at the keyboard)
 * - Notes in the future are ABOVE hitLineY (smaller y)
 * - Notes in the past are BELOW hitLineY (larger y, off screen)
 */
export function noteToScreenY(noteTime: number, vp: Viewport): number {
  const hitLineY = vp.height
  return hitLineY - (noteTime - vp.currentTime) * vp.pps
}

/**
 * Convert a note's duration to pixel height.
 */
export function durationToHeight(duration: number, pps: number): number {
  return duration * pps
}

/**
 * Get the visible time range for culling.
 * Returns [startTime, endTime] — only notes within this range need rendering.
 */
export function getVisibleTimeRange(vp: Viewport): [number, number] {
  // A note is visible if its bottom edge (noteTime) is above 0
  // and its top edge (noteTime + duration) is below canvas height.
  // We add a small margin for notes partially on screen.
  const windowSeconds = vp.height / vp.pps
  const startTime = vp.currentTime                   // earliest visible note start
  const endTime = vp.currentTime + windowSeconds      // latest visible note start
  return [startTime, endTime]
}

/**
 * Filter notes to only those visible in the current viewport.
 * Notes are assumed to be sorted by time (ascending).
 * Uses binary search for efficiency on large track arrays.
 */
export function getVisibleNotes(notes: ParsedNote[], vp: Viewport): ParsedNote[] {
  const [startTime, endTime] = getVisibleTimeRange(vp)

  // Binary search for first note that could be visible
  // A note is visible if: note.time + note.duration > startTime AND note.time < endTime
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (notes[mid].time + notes[mid].duration < startTime) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }

  const result: ParsedNote[] = []
  for (let i = lo; i < notes.length; i++) {
    const note = notes[i]
    if (note.time > endTime) break
    result.push(note)
  }
  return result
}
