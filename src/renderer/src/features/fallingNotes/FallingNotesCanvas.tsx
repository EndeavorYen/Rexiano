import { useRef, useEffect } from "react";
import "pixi.js/unsafe-eval";
import { Application } from "pixi.js";
import { NoteRenderer } from "@renderer/engines/fallingNotes/NoteRenderer";
import { getCanvasBgColor } from "@renderer/engines/fallingNotes/noteColors";
import { createTickerUpdate } from "@renderer/engines/fallingNotes/tickerLoop";
import { useThemeStore } from "@renderer/stores/useThemeStore";

interface FallingNotesCanvasProps {
  /** Callback to send active MIDI notes to PianoKeyboard */
  onActiveNotesChange?: (notes: Set<number>) => void;
  /** Phase 4: Get current playback time from AudioScheduler */
  getAudioCurrentTime?: () => number | null;
  /** Expose the NoteRenderer instance for external use (e.g. practice visual feedback) */
  onNoteRendererReady?: (renderer: NoteRenderer) => void;
  /** Optional minimum render height in px */
  minHeight?: number;
}

export function FallingNotesCanvas({
  onActiveNotesChange,
  getAudioCurrentTime,
  onNoteRendererReady,
  minHeight = 200,
}: FallingNotesCanvasProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const rendererRef = useRef<NoteRenderer | null>(null);

  // Stable ref so the ticker closure always sees the latest callback
  // without re-running the effect (fix: avoid destroying PixiJS on parent re-render)
  const onActiveNotesChangeRef = useRef(onActiveNotesChange);
  useEffect(() => {
    onActiveNotesChangeRef.current = onActiveNotesChange;
  }, [onActiveNotesChange]);

  // Stable ref for audio time callback
  const getAudioCurrentTimeRef = useRef(getAudioCurrentTime);
  useEffect(() => {
    getAudioCurrentTimeRef.current = getAudioCurrentTime;
  }, [getAudioCurrentTime]);

  // Stable ref for note renderer callback
  const onNoteRendererReadyRef = useRef(onNoteRendererReady);
  useEffect(() => {
    onNoteRendererReadyRef.current = onNoteRendererReady;
  }, [onNoteRendererReady]);

  // One-time PixiJS setup + teardown
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const app = new Application();
    let destroyed = false;
    let resizeObserver: ResizeObserver | null = null;
    let unsubTheme: (() => void) | null = null;

    const setup = async (): Promise<void> => {
      await app.init({
        background: getCanvasBgColor(),
        resizeTo: container,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      // Cap at 60fps to avoid wasting CPU/GPU on high-refresh-rate monitors
      app.ticker.maxFPS = 60;

      if (destroyed) {
        app.destroy();
        return;
      }

      container.appendChild(app.canvas);
      appRef.current = app;

      // Create the note renderer
      const noteRenderer = new NoteRenderer(app.stage);
      noteRenderer.init(app.screen.width);
      rendererRef.current = noteRenderer;
      onNoteRendererReadyRef.current?.(noteRenderer);

      // Main render loop — uses extracted tickerLoop for testability
      app.ticker.add(
        createTickerUpdate(
          noteRenderer,
          () => ({ width: app.screen.width, height: app.screen.height }),
          onActiveNotesChangeRef,
          () => getAudioCurrentTimeRef.current?.() ?? null,
        ),
      );

      // S9-R1-04: Guard against destroyed state before creating subscriptions.
      // If the component unmounted while app.init() was awaiting, setup() continues
      // past the first `destroyed` check but creates subscriptions on a doomed app.
      if (destroyed) {
        noteRenderer.destroy();
        app.destroy();
        return;
      }

      // Update canvas background when theme changes
      unsubTheme = useThemeStore.subscribe(() => {
        // S9-R1-04: Guard callback — prevent writes to destroyed renderer
        if (destroyed) return;
        app.renderer.background.color = getCanvasBgColor();
      });

      // Resize handler — attached after init so the first resize event
      // fires when appRef and rendererRef are already set
      resizeObserver = new ResizeObserver(() => {
        if (appRef.current && rendererRef.current) {
          rendererRef.current.resize(appRef.current.screen.width);
        }
      });
      resizeObserver.observe(container);
    };

    void setup().catch((err) => {
      console.error("[FallingNotesCanvas] WebGL/PixiJS init failed:", err);
    });

    return () => {
      destroyed = true;
      unsubTheme?.();
      resizeObserver?.disconnect();
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy({ removeView: true });
        appRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full overflow-hidden"
      style={{ minHeight }}
    />
  );
}
