# WHITE TEAM RESPONSE: Audio Quality (Round 2)

## Summary
- Issues addressed: 1 fixed, 3 accepted (minor/by-design)

---

## FIXES APPLIED

**W2-001** — Fix R2-001 (MAJOR): Metronome double-attenuation
- **Root cause**: The `× 0.5` constant in `_scheduleClick` was a workaround for when metronome bypassed master volume — now that it routes through masterGain, this halves the volume unnecessarily
- **Fix**: Changed `peakGain = this._volume * 0.5` → `peakGain = this._volume`
- **Result**: At default settings (metronome=0.5, master=1.0), effective gain is now 0.5 — appropriate click volume
- **File**: MetronomeEngine.ts:235

---

## ACCEPTED (No Fix Needed)

| Issue | Rationale |
|-------|-----------|
| R2-002 (linear vs exponential ramp inconsistency) | By design. `linearRamp` is correct for volume control (can target 0). `exponentialRamp` is correct for note release (natural decay curve). Different use cases warrant different envelope shapes. |
| R2-003 (masterGain exposes mutable state) | Acceptable trade-off. The getter is used only for audio routing (connecting metronome destination). Adding a proxy or wrapper would add unnecessary complexity. Internal-only API. |
| R2-004 (LIFO noteOff vs pre-scheduled overlapping notes) | Edge case. The AudioScheduler pre-schedules noteOn and noteOff at precise times. For same-key overlapping notes from MIDI files, the `onended` auto-cleanup handles natural note termination correctly — the scheduler's noteOff only fires the release envelope early. In practice, MIDI files rarely have same-key overlapping notes (they're logically the same keypress). The LIFO fix primarily benefits real-time MIDI input where trills are common. |

---

## Verification
- All 1227 tests passing (75 test files)
