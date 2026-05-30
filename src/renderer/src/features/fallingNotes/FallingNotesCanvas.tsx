import { useRef, useEffect, useState } from "react";
import "pixi.js/unsafe-eval";
import { Application } from "pixi.js";
import { NoteRenderer } from "@renderer/engines/fallingNotes/NoteRenderer";
import { getCanvasBgColor } from "@renderer/engines/fallingNotes/noteColors";
import { createTickerUpdate } from "@renderer/engines/fallingNotes/tickerLoop";
import {
  formatRenderDiagnosticsSummary,
  readRenderDiagnosticsFlag,
  type RenderDiagnosticsFrame,
} from "@renderer/engines/fallingNotes/renderDiagnostics";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import {
  describeFallingNotesInitFailure,
  type FallingNotesInitFailure,
} from "./fallingNotesInitFailure";

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
  const [diagnosticsEnabled] = useState(readRenderDiagnosticsFlag);
  const [renderDiagnostics, setRenderDiagnostics] =
    useState<RenderDiagnosticsFrame | null>(null);
  const [initFailure, setInitFailure] =
    useState<FallingNotesInitFailure | null>(null);
  const diagnosticsThrottleRef = useRef(0);
  const { t } = useTranslation();

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

  const onRenderDiagnosticsRef = useRef<
    ((frame: RenderDiagnosticsFrame) => void) | undefined
  >(undefined);
  useEffect(() => {
    if (!diagnosticsEnabled) {
      onRenderDiagnosticsRef.current = undefined;
      return;
    }

    onRenderDiagnosticsRef.current = (frame) => {
      const now = performance.now();
      if (now - diagnosticsThrottleRef.current < 250) return;
      diagnosticsThrottleRef.current = now;
      setRenderDiagnostics(frame);
    };
  }, [diagnosticsEnabled]);

  // One-time PixiJS setup + teardown
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const app = new Application();
    let destroyed = false;
    let resizeObserver: ResizeObserver | null = null;
    let unsubTheme: (() => void) | null = null;

    const setup = async (): Promise<void> => {
      try {
        await app.init({
          background: getCanvasBgColor(),
          resizeTo: container,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
        });
      } catch (error) {
        if (!destroyed) {
          console.error(
            "FallingNotesCanvas: PixiJS initialization failed",
            error,
          );
          setInitFailure(describeFallingNotesInitFailure(error));
        }
        app.destroy();
        return;
      }

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
          diagnosticsEnabled
            ? (frame) => onRenderDiagnosticsRef.current?.(frame)
            : undefined,
        ),
      );

      // Update canvas background when theme changes
      unsubTheme = useThemeStore.subscribe(() => {
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

    setup();

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
  }, [diagnosticsEnabled]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 w-full overflow-hidden"
      style={{ minHeight }}
    >
      {initFailure ? (
        <div
          role="alert"
          data-testid="falling-notes-render-failure"
          className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center"
          style={{
            color: "var(--color-text)",
            background:
              "color-mix(in srgb, var(--color-surface) 92%, transparent)",
          }}
        >
          <div className="max-w-md">
            <p className="mb-2 font-display text-lg font-bold">
              {t(initFailure.titleKey)}
            </p>
            <p className="font-body text-sm text-[var(--color-text-muted)]">
              {t(initFailure.guidanceKey)}
            </p>
            <p className="mt-3 font-mono text-xs text-[var(--color-text-muted)]">
              {initFailure.detail}
            </p>
          </div>
        </div>
      ) : null}
      {diagnosticsEnabled && renderDiagnostics ? (
        <div
          data-testid="render-diagnostics-overlay"
          className="pointer-events-none absolute right-2 top-2 z-10 rounded px-2 py-1 font-mono text-[10px] leading-tight"
          style={{
            color: "#d1fae5",
            background: "rgba(6, 78, 59, 0.82)",
            border: "1px solid rgba(167, 243, 208, 0.42)",
          }}
        >
          {formatRenderDiagnosticsSummary(renderDiagnostics).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
