# RED TEAM REPORT: Audio Quality (Round 2)

## Summary
- R1 fixes verified: 3/3 functional
- New issues found: 4 (0 Critical, 1 Major, 3 Minor)

---

## R1 FIX VERIFICATION

| Fix | Status | Notes |
|-----|--------|-------|
| W1-001 (volume smooth ramp) | PASS | `linearRampToValueAtTime` with 8ms ramp eliminates click/pop. `cancelScheduledValues` prevents ramp conflicts. |
| W1-002 (metronome master volume) | PASS | `MetronomeEngine` now accepts optional `destination` node. App.tsx passes `engine.masterGain`. Backward-compatible default to `audioContext.destination`. |
| W1-003 (noteOff LIFO) | PASS | `notes.pop()` correctly releases the most recent note. Trill behavior now matches physical piano semantics. |

---

## NEW ISSUES (R2)

**ISSUE-R2-001** (MAJOR) — Metronome volume stacks with master volume creating double-attenuation
- MetronomeEngine has its own `_volume` field (0.0–1.0, default 0.5) controlling peak gain at line 235: `peakGain = this._volume * 0.5`
- Now that metronome routes through `masterGain`, the effective volume is: `metronomeVolume × 0.5 × masterVolume`
- At default settings (metronome=0.5, master=1.0): effective metronome gain = 0.25 — too quiet
- When user lowers master volume to 0.5: effective gain = 0.125 — barely audible
- The `× 0.5` constant was originally needed to prevent metronome from being too loud when it bypassed master volume; now it over-attenuates
- File: MetronomeEngine.ts:235

**ISSUE-R2-002** (MINOR) — `setVolume` ramp target 0 causes `linearRampToValueAtTime(0)` which is valid but inconsistent
- `linearRampToValueAtTime(0, ...)` works correctly for setting volume to 0
- However, `_releaseNote` uses `exponentialRampToValueAtTime(0.001, ...)` because exponential ramp can't target 0
- Inconsistent approach: volume uses linear ramp, release uses exponential. Not a bug, but note the asymmetry.
- File: AudioEngine.ts:333 vs 275

**ISSUE-R2-003** (MINOR) — `masterGain` getter exposes internal mutable state
- `AudioEngine.masterGain` returns the raw `GainNode` reference
- External code could modify `masterGain.gain.value` directly, bypassing the smooth ramp logic in `setVolume()`
- Low risk since only `metronomeManager` uses it and only for routing, not volume control
- File: AudioEngine.ts:72-74

**ISSUE-R2-004** (MINOR) — AudioScheduler noteOff is pre-scheduled, may conflict with LIFO noteOn order
- `AudioScheduler._tick()` calls `noteOn` then `noteOff` for each note in sequence (lines 196-203)
- For overlapping same-key notes, noteOff is scheduled at a future AudioContext time
- The LIFO fix in AudioEngine.noteOff works for real-time MIDI input but the scheduler pre-schedules both noteOn and noteOff at precise times
- Since noteOff uses `notes.pop()`, if two overlapping same-key notes have noteOn at t=0 and t=0.3, and noteOff at t=0.5 and t=0.8, the first noteOff (t=0.5) will pop the second note (started at t=0.3) instead of the first (started at t=0)
- This is the original problem in reverse — LIFO is correct for real-time input but wrong for pre-scheduled overlapping notes
- File: AudioScheduler.ts:196-203, AudioEngine.ts:190
