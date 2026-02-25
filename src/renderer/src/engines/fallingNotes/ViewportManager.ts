import type { ParsedNote } from '@renderer/engines/midi/types'

export interface Viewport {
  width: number
  height: number
  pps: number
  currentTime: number
}

export function noteToScreenY(noteTime: number, vp: Viewport): number {
  const hitLineY = vp.height
  return hitLineY - (noteTime - vp.currentTime) * vp.pps
}

export function durationToHeight(duration: number, pps: number): number {
  return duration * pps
}

export function getVisibleTimeRange(vp: Viewport): [number, number] {
  const windowSeconds = vp.height / vp.pps
  const startTime = vp.currentTime
  const endTime = vp.currentTime + windowSeconds
  return [startTime, endTime]
}

export function getVisibleNotes(notes: ParsedNote[], vp: Viewport): ParsedNote[] {
  const [startTime, endTime] = getVisibleTimeRange(vp)

  // Binary search for first note that could be visible.
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
