import { useRef, useEffect } from 'react'
import { Application } from 'pixi.js'
import { NoteRenderer } from '@renderer/engines/fallingNotes/NoteRenderer'
import { useSongStore } from '@renderer/stores/useSongStore'
import { usePlaybackStore } from '@renderer/stores/usePlaybackStore'
import type { Viewport } from '@renderer/engines/fallingNotes/ViewportManager'

interface FallingNotesCanvasProps {
  /** Callback to send active MIDI notes to PianoKeyboard */
  onActiveNotesChange?: (notes: Set<number>) => void
}

export function FallingNotesCanvas({ onActiveNotesChange }: FallingNotesCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const rendererRef = useRef<NoteRenderer | null>(null)

  // One-time PixiJS setup + teardown
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let destroyed = false

    const setup = async (): Promise<void> => {
      await app.init({
        background: 0xfafaf9, // stone-50, matches Tailwind bg
        resizeTo: container,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      })

      if (destroyed) {
        app.destroy()
        return
      }

      container.appendChild(app.canvas)
      appRef.current = app

      // Create the note renderer
      const noteRenderer = new NoteRenderer(app.stage)
      noteRenderer.init(app.screen.width)
      rendererRef.current = noteRenderer

      // Main render loop
      app.ticker.add((time) => {
        const songState = useSongStore.getState()
        const playState = usePlaybackStore.getState()
        if (!songState.song) return

        // Advance time if playing
        if (playState.isPlaying) {
          const dt = time.deltaMS / 1000
          const nextTime = Math.min(
            playState.currentTime + dt,
            songState.song.duration
          )
          usePlaybackStore.getState().setCurrentTime(nextTime)

          // Auto-stop at end
          if (nextTime >= songState.song.duration) {
            usePlaybackStore.getState().setPlaying(false)
          }
        }

        const vp: Viewport = {
          width: app.screen.width,
          height: app.screen.height,
          pps: playState.pixelsPerSecond,
          currentTime: usePlaybackStore.getState().currentTime,
        }

        noteRenderer.update(songState.song, vp)

        // Notify React about active notes (for keyboard highlight)
        if (onActiveNotesChange) {
          onActiveNotesChange(new Set(noteRenderer.activeNotes))
        }
      })
    }

    setup()

    // Resize handler
    const resizeObserver = new ResizeObserver(() => {
      if (appRef.current && rendererRef.current) {
        rendererRef.current.resize(appRef.current.screen.width)
      }
    })
    resizeObserver.observe(container)

    return () => {
      destroyed = true
      resizeObserver.disconnect()
      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }
      if (appRef.current) {
        appRef.current.destroy({ removeView: true }, { children: true })
        appRef.current = null
      }
    }
  }, [onActiveNotesChange])

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full overflow-hidden"
      style={{ minHeight: 200 }}
    />
  )
}
