import { useRef, useEffect } from 'react'
import { Application } from 'pixi.js'
import { NoteRenderer } from '@renderer/engines/fallingNotes/NoteRenderer'
import { createTickerUpdate } from '@renderer/engines/fallingNotes/tickerLoop'

interface FallingNotesCanvasProps {
  /** Callback to send active MIDI notes to PianoKeyboard */
  onActiveNotesChange?: (notes: Set<number>) => void
}

export function FallingNotesCanvas({ onActiveNotesChange }: FallingNotesCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const rendererRef = useRef<NoteRenderer | null>(null)

  // Stable ref so the ticker closure always sees the latest callback
  // without re-running the effect (fix: avoid destroying PixiJS on parent re-render)
  const onActiveNotesChangeRef = useRef(onActiveNotesChange)
  onActiveNotesChangeRef.current = onActiveNotesChange

  // One-time PixiJS setup + teardown
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const app = new Application()
    let destroyed = false
    let resizeObserver: ResizeObserver | null = null

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

      // Main render loop — uses extracted tickerLoop for testability
      app.ticker.add(createTickerUpdate(
        noteRenderer,
        () => ({ width: app.screen.width, height: app.screen.height }),
        onActiveNotesChangeRef,
      ))

      // Resize handler — attached after init so the first resize event
      // fires when appRef and rendererRef are already set
      resizeObserver = new ResizeObserver(() => {
        if (appRef.current && rendererRef.current) {
          rendererRef.current.resize(appRef.current.screen.width)
        }
      })
      resizeObserver.observe(container)
    }

    setup()

    return () => {
      destroyed = true
      resizeObserver?.disconnect()
      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }
      if (appRef.current) {
        appRef.current.destroy({ removeView: true })
        appRef.current = null
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full min-h-[200px] overflow-hidden"
    />
  )
}
