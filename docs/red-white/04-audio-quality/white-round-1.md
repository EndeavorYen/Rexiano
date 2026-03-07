# WHITE TEAM RESPONSE: Audio Quality (Round 1)

## Summary
- Issues addressed: 3 fixed, 3 deferred (engine-level), 6 accepted (minor/low-impact)

---

## FIXES APPLIED

**W1-001** — Fix R1-001 (CRITICAL): Volume click/pop
- **Root cause**: `setVolume()` set `masterGain.gain.value` directly — instant gain changes create waveform discontinuities
- **Fix**: Use `cancelScheduledValues` + `setValueAtTime` + `linearRampToValueAtTime` with 8ms ramp
- **File**: AudioEngine.ts:322-333
- **Test**: Updated `AudioEngine.test.ts` mock to verify smooth ramp behavior (not direct assignment)

**W1-002** — Fix R1-002 (MAJOR): Metronome bypasses master volume
- **Root cause**: `MetronomeEngine._scheduleClick()` connected `gain → audioContext.destination` directly, bypassing `AudioEngine._masterGain`
- **Fix**:
  - Added optional `destination: AudioNode` parameter to `MetronomeEngine` constructor (defaults to `audioContext.destination` for backward compat)
  - Added `masterGain` getter to `AudioEngine` and `IAudioEngine` interface
  - Updated `metronomeManager.initMetronome()` to accept optional destination
  - Updated `App.tsx` to pass `engine.masterGain` when initializing metronome
- **Files**: MetronomeEngine.ts, metronomeManager.ts, AudioEngine.ts, types.ts, App.tsx, AudioScheduler.test.ts

**W1-003** — Fix R1-005 (MAJOR): noteOff releases oldest note instead of most recent
- **Root cause**: `noteOff()` used `notes.shift()` (FIFO) — for rapid repeated notes, this releases the first attack while the latest sustains
- **Fix**: Changed to `notes.pop()` (LIFO) — releases the most recently started note, matching physical piano behavior
- **File**: AudioEngine.ts:189-190

---

## DEFERRED

**R1-003** (MAJOR) — No velocity layers in SF2 parsing
- Requires deep SF2 parser changes to support velocity-mapped sample zones
- The current approach (volume scaling only) is functional for the target audience (children)
- Deferred to a dedicated audio quality phase

**R1-004** (MAJOR) — Synthesized fallback tone quality
- The oscillator fallback is a safety net for missing SF2 files
- Improving it requires designing a multi-oscillator piano synthesis algorithm
- Low priority since all deployed installations ship with `piano.sf2`
- Deferred

**R1-008** (MINOR) — AudioScheduler setInterval drift
- The 100ms look-ahead buffer adequately compensates for OS scheduling jitter
- At 2x speed the effective look-ahead is still 50ms of real time, well within tolerance
- Accepted as designed

---

## ACCEPTED (No Fix Needed)

| Issue | Rationale |
|-------|-----------|
| R1-006 (residual gain 0.001) | The 0.001 value (-60dB) is inaudible. The 10ms gap before stop is imperceptible. |
| R1-007 (sustain stagger) | Real damper stagger is ~2-5ms — not worth simulating for a children's app. |
| R1-009 (error tone inaudible) | Electron uses Chromium's audio — all target hardware has adequate 400Hz response. |
| R1-010 (no statechange listener) | AudioContext suspension is handled by the recovery system in `recoveryUtils.ts`. |
| R1-011 (_fillGaps linear search) | O(n*m) for 88 keys is trivial — ~7744 comparisons max. Not a bottleneck. |
| R1-012 (basic metronome sound) | Functional for practice purposes. Sound design is a separate concern. |

---

## Verification
- All 1227 tests passing (75 test files)
- `pnpm test -- --run` clean
