# Editor Export

Phase 8 currently supports MIDI export from the piano-roll editor.

## MIDI Export

- The editor serializes `EditableSong` data with `@tonejs/midi`.
- Track names and MIDI channels are preserved.
- Note pitch, start time, duration, and velocity are clamped to valid MIDI-safe
  ranges before writing.
- The renderer sends `number[]` MIDI bytes over IPC, and the main process writes
  the selected file through Electron's save dialog.
- Exported files are approved for direct re-open through Rexiano's recent-file
  path access guard.

Verification:

```sh
pnpm test src/renderer/src/features/editor/midiExport.test.ts src/main/ipc/fileHandlers.test.ts
```

## MusicXML Boundary

MusicXML export is intentionally deferred from this first MIDI editing slice.
Unlike MIDI export, MusicXML requires notation-specific decisions for measures,
voices, rests, stems, ties, tuplets, and cross-staff layout. Those semantics
belong in a later notation-export issue after the piano-roll editing model has
stabilized.
