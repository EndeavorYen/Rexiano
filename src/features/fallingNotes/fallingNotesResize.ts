interface ResizableApp {
  resize(): void;
  screen: { width: number };
}

interface ResizableRenderer {
  resize(canvasWidth: number): void;
}

/**
 * Resize the PixiJS renderer to its container, then re-lay out the keys.
 *
 * PixiJS `resizeTo` only reacts to window `resize` events. A display-mode
 * switch (split ↔ falling) changes the container without one, so the
 * container's ResizeObserver must drive `app.resize()` itself.
 */
export function syncFallingNotesSize(
  app: ResizableApp,
  renderer: ResizableRenderer,
): void {
  app.resize();
  renderer.resize(app.screen.width);
}
