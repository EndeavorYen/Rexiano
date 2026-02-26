import type { NoteRenderer } from './NoteRenderer'
import type { Viewport } from './ViewportManager'
import { useSongStore } from '@renderer/stores/useSongStore'
import { usePlaybackStore } from '@renderer/stores/usePlaybackStore'

/** Cap frame delta to prevent large time jumps (e.g. after tab backgrounding) */
const MAX_DELTA_SECONDS = 0.1

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

/**
 * Create the per-frame ticker callback for the falling notes render loop.
 *
 * Reads song/playback state from Zustand stores, advances time when playing,
 * updates the NoteRenderer, and notifies about active notes only when they change.
 */
export function createTickerUpdate(
  noteRenderer: NoteRenderer,
  getScreenSize: () => { width: number; height: number },
  onActiveNotesChangeRef: { current: ((notes: Set<number>) => void) | undefined },
  getAudioCurrentTime?: () => number | null,
) {
  let prevActiveNotes = new Set<number>()

  return (time: { deltaMS: number }) => {
    const songState = useSongStore.getState()
    const playState = usePlaybackStore.getState()
    if (!songState.song) return

    let effectiveTime = playState.currentTime

    if (playState.isPlaying) {
      const audioTime = getAudioCurrentTime?.()
      if (audioTime != null) {
        effectiveTime = Math.min(audioTime, songState.song.duration)
      } else {
        const dt = Math.min(time.deltaMS / 1000, MAX_DELTA_SECONDS)
        effectiveTime = Math.min(effectiveTime + dt, songState.song.duration)
      }
      playState.setCurrentTime(effectiveTime)

      if (effectiveTime >= songState.song.duration) {
        playState.setPlaying(false)
      }
    }

    const screen = getScreenSize()
    const vp: Viewport = {
      width: screen.width,
      height: screen.height,
      pps: playState.pixelsPerSecond,
      currentTime: effectiveTime,
    }

    noteRenderer.update(songState.song, vp)

    // Only notify React when active notes actually change
    if (onActiveNotesChangeRef.current) {
      const next = noteRenderer.activeNotes
      if (!setsEqual(prevActiveNotes, next)) {
        const snapshot = new Set(next)
        prevActiveNotes = snapshot
        onActiveNotesChangeRef.current(snapshot)
      }
    }
  }
}
