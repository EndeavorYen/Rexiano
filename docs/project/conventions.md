# Phase-Specific Conventions

## Practice Mode (Phase 6)

### Architecture

```
engines/practice/        <- Pure logic (no React)
  WaitMode.ts           <- State machine (playing -> waiting -> idle)
  SpeedController.ts    <- Speed control (0.25x ~ 2.0x, clamped)
  LoopController.ts     <- A-B loop logic
  ScoreCalculator.ts    <- Score accumulator (hit/miss/streak/accuracy)
  practiceManager.ts    <- Module-level singleton (init / get / dispose)
stores/
  usePracticeStore.ts   <- Zustand store (mode / speed / loopRange / activeTracks / score)
features/practice/       <- React UI
  PracticeModeSelector  <- Watch / Wait / Free mode switch
  SpeedSlider           <- Speed presets + continuous slider
  ABLoopSelector        <- A-B loop start/end
  TrackSelector         <- Hand-split track checkboxes
  ScoreOverlay          <- Real-time score HUD (top-right float)
  PracticeToolbar       <- Composite (embedded in App layout, below TransportBar)
```

### Key Design Decisions

- **WaitMode uses state machine + callback pattern**: `WaitModeCallbacks` interface (`onWait` / `onResume` / `onHit` / `onMiss`), no direct React dependency
- **Chord detection**: WaitMode collects all notes within +/-200ms window as a chord group, all must be pressed to continue
- **Engine classes are pure functional**: SpeedController / LoopController / ScoreCalculator use getter/setter + validation, independently testable
- **practiceManager.ts singleton**: Engine instances managed as module-level variables (`initPracticeEngines` / `getPracticeEngines` / `disposePracticeEngines`), accessed via import in tickerLoop and App.tsx
- **Integration complete**: tickerLoop has WaitMode gating + speed multiplier + loop detection; App.tsx has engine lifecycle + callback wiring + MIDI routing + UI embedding

## MIDI Device (Phase 5)

### Architecture

```
engines/midi/          <- Pure logic (no React)
  MidiDeviceManager.ts <- Singleton, manages Web MIDI API access and device list
  MidiInputParser.ts   <- Parses MIDI messages (Note On/Off/CC), callback-based
  MidiOutputSender.ts  <- Sends MIDI messages to output device
stores/
  useMidiDeviceStore.ts <- Zustand store, bridges engine -> React
features/midiDevice/   <- React UI
  DeviceSelector.tsx   <- Device dropdown (embedded in TransportBar)
  ConnectionStatus.tsx <- Connection status indicator
```

### Key Design Decisions

- **MidiDeviceManager uses Singleton** (`getInstance()`), because Web MIDI API's `MIDIAccess` is globally unique
- **MidiInputParser uses callback pattern** (`onNoteOn(cb)` / `onNoteOff(cb)` / `onCC(cb)`), not EventEmitter
- **Parser-Store bridge**: `useMidiDeviceStore` manages `_parser` instance at module level, `syncParserToActiveInput()` auto attach/detach on device switch
- **Connection indicator uses fixed colors (not theme vars)**: Green/gray/red have universal semantic meaning, must maintain consistent contrast across all themes (see `ConnectionStatus.tsx` JSDoc)
- **Electron MIDI permissions**: main process auto-approves `midi` permission via `session.setPermissionRequestHandler` (`src/main/ipc/midiDeviceHandlers.ts`)

### Test Notes

- Web MIDI API `MIDIInput.onmidimessage` type has `this: MIDIInput` constraint; tests need helper function to cast it away (see `MidiInputParser.test.ts` `getHandler()`)
- Mock `MIDIInput` uses `as unknown as MIDIInput` type assertion

## Audio Engine (Phase 4)

### Architecture

```
engines/audio/
  AudioEngine.ts       <- Web Audio API wrapper (init / noteOn / noteOff / allNotesOff)
  AudioScheduler.ts    <- Look-ahead scheduler (100ms pre-schedule, 25ms interval)
  SoundFontLoader.ts   <- SF2 parsing + synth fallback
```

### Key Points

- **Time base**: Playback uses `AudioContext.currentTime` (hardware clock), not `requestAnimationFrame`
- **SoundFont**: `resources/piano.sf2` (TimGM6mb, 6MB), sent to renderer via IPC as `number[]`
- **Synth fallback**: If SF2 loading fails, falls back to sine wave synthesis
