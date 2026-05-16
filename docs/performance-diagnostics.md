# Performance Diagnostics

Rexiano keeps falling-notes diagnostics off during normal use. Developers can
enable a compact overlay without changing source code:

```bash
localStorage.setItem("rexiano.renderDiagnostics", "1")
```

Reload the app after setting the flag. The overlay can also be enabled by adding
either query parameter to the renderer URL:

```text
?renderDiagnostics=1
?rexianoPerf=true
```

## Metrics

- `FPS / frame` shows ticker cadence and measured ticker work duration.
- `Notes` shows visible notes in the current viewport against total song notes.
- `Sprites` shows active PixiJS sprites, total allocated sprites, and sprite-pool
  growth beyond the initial pool.
- `Labels` shows note-name labels and fingering labels currently active.

Use this view when checking dense MIDI passages or regressions in the
falling-notes renderer. The overlay is intentionally developer-only and remains
hidden unless one of the flags above is enabled.
