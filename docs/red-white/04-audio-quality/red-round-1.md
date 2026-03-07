# RED TEAM REPORT: Audio Quality (Round 1)

## Summary
- Total issues found: 12
- Critical: 1
- Major: 4
- Minor: 7

---

## CRITICAL ISSUES

**ISSUE-R1-001** (CRITICAL) — Volume change causes audible click/pop
- `AudioEngine.setVolume()` sets `masterGain.gain.value` directly (line 323)
- Instant gain changes create discontinuities in the audio waveform, producing audible clicks
- Should use `gain.linearRampToValueAtTime()` or `exponentialRampToValueAtTime()` with a short ramp (5-10ms)
- This is especially noticeable when dragging the volume slider quickly
- File: AudioEngine.ts:322-326

---

## MAJOR ISSUES

**ISSUE-R1-002** (MAJOR) — Metronome click bypasses master volume
- MetronomeEngine connects directly to `audioContext.destination` (line 233)
- AudioEngine has a `_masterGain` that controls volume, but metronome doesn't use it
- When user mutes or lowers volume, metronome clicks still play at full volume
- File: MetronomeEngine.ts:232-233

**ISSUE-R1-003** (MAJOR) — No velocity layers in SF2 parsing
- `SoundFontLoader._parseSF2()` calls `getKeyData(midi, 0, 0)` which gets one sample per key
- No velocity parameter passed — all velocities play the same sample
- A piano sounds very different at pp vs ff; this flattens the dynamic range
- The velocity gain scaling in `AudioEngine.noteOn()` (line 143) only adjusts volume, not timbre
- File: SoundFontLoader.ts:122-123

**ISSUE-R1-004** (MAJOR) — Synthesized fallback tone quality is poor
- The oscillator fallback uses dual triangle waves with +3 cents detune
- This sounds nothing like a piano — it's a buzzy, thin tone
- 2-second duration with simple ADSR is inadequate for long notes
- No harmonic overtones, no stereo width, no velocity-dependent timbre
- While documented as a "fallback", it may be the first experience for users without SF2
- File: SoundFontLoader.ts:250-333

**ISSUE-R1-005** (MAJOR) — `noteOff` releases oldest note, not most recent
- `AudioEngine.noteOff()` uses `notes.shift()` (line 185) — FIFO order
- For rapid repeated notes on the same key, this releases the first attack while the latest sustains
- Should use `notes.pop()` (LIFO) to release the most recently started note
- This causes reversed note ordering when playing trills or repeated notes
- File: AudioEngine.ts:185

---

## MINOR ISSUES

**ISSUE-R1-006** (MINOR) — `_releaseNote` exponentialRamp to 0.001 leaves residual gain
- `gain.gain.exponentialRampToValueAtTime(0.001, time + releaseTime)` (line 270)
- The source stops at `time + releaseTime + 0.01` (line 271), but gain is still at 0.001
- There's a 10ms gap between "nearly silent" (0.001) and "stop" — may produce a tiny click
- Should ramp to lower value (0.0001) or set gain to 0 before stopping

**ISSUE-R1-007** (MINOR) — Sustain pedal release uses `audioContext.currentTime`
- `sustainOff()` uses `this._audioContext?.currentTime ?? 0` (line 213)
- If called during a look-ahead scheduling window, time could be slightly stale
- All sustained notes release at exactly the same instant, which sounds unnatural
- Real pianos have slight stagger in damper fall

**ISSUE-R1-008** (MINOR) — AudioScheduler `setInterval` drift
- `setInterval` is not guaranteed to fire at exact intervals — OS scheduling jitter
- The 25ms interval combined with 100ms look-ahead provides adequate buffer
- But at high speed (2x), the effective look-ahead is 200ms of song time, which may be audible as latency
- File: AudioScheduler.ts:81

**ISSUE-R1-009** (MINOR) — Error tone (400→200Hz) may be inaudible on some speakers
- `playErrorTone()` uses 400Hz sine swept to 200Hz at 0.15 gain
- Some laptop speakers have poor low-frequency response below 300Hz
- The 80ms duration may be too short to be perceptible during fast playing
- File: AudioEngine.ts:296-298

**ISSUE-R1-010** (MINOR) — No AudioContext `state` monitoring
- AudioContext can be suspended by the browser (background tab, power saving)
- No listener for `audioContext.onstatechange` to detect and handle suspensions
- The `resume()` method exists but is only called manually
- File: AudioEngine.ts

**ISSUE-R1-011** (MINOR) — `_fillGaps` uses linear search for nearest sample
- `SoundFontLoader._fillGaps()` iterates all loaded samples for each missing key
- O(n*m) complexity where n = missing keys, m = loaded samples
- For 88 keys this is trivial, but the algorithm could be O(n) with sorted iteration
- File: SoundFontLoader.ts:216-241

**ISSUE-R1-012** (MINOR) — Metronome click sound is basic sine wave
- Simple 1000Hz/1500Hz sine pulse sounds like a beep, not a professional metronome
- Could use a short noise burst or wood-block-like synthesis for more musical feel
- Low priority since it's functional
- File: MetronomeEngine.ts:220-243
