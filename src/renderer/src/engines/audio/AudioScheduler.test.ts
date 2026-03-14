import {
  describe,
  test,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import { AudioScheduler } from "./AudioScheduler";
import type { IAudioEngine } from "./types";
import type { ParsedSong, ParsedNote, ParsedTrack } from "../midi/types";

// ─── Helpers ─────────────────────────────────────

function note(
  time: number,
  duration: number,
  midi = 60,
  velocity = 80,
): ParsedNote {
  return { midi, name: "C4", time, duration, velocity };
}

function track(notes: ParsedNote[], name = "Piano"): ParsedTrack {
  return { name, instrument: "Piano", channel: 0, notes };
}

function song(tracks: ParsedTrack[], duration?: number): ParsedSong {
  const maxEnd = tracks
    .flatMap((t) => t.notes)
    .reduce((m, n) => Math.max(m, n.time + n.duration), 0);
  return {
    fileName: "test.mid",
    duration: duration ?? maxEnd,
    tracks,
    tempos: [{ time: 0, bpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    keySignatures: [],
    noteCount: tracks.reduce((sum, t) => sum + t.notes.length, 0),
  };
}

/** Mock engine type with vi.fn() mocks exposed for assertions */
interface MockAudioEngine {
  status: "ready";
  audioContext: AudioContext;
  masterGain: GainNode | null;
  init: Mock;
  noteOn: Mock;
  noteOff: Mock;
  allNotesOff: Mock;
  sustainOn: Mock;
  sustainOff: Mock;
  resume: Mock;
  suspend: Mock;
  setVolume: Mock;
  setReleaseTime: Mock;
  playErrorTone: Mock;
  dispose: Mock;
  _setCurrentTime: (t: number) => void;
}

/** Create a mock IAudioEngine with controllable currentTime */
function createMockEngine(initialTime = 0): MockAudioEngine {
  let currentTime = initialTime;
  const ctx = {
    get currentTime() {
      return currentTime;
    },
  } as AudioContext;

  return {
    status: "ready" as const,
    audioContext: ctx,
    masterGain: null,
    init: vi.fn().mockResolvedValue(undefined),
    noteOn: vi.fn(),
    noteOff: vi.fn(),
    allNotesOff: vi.fn(),
    sustainOn: vi.fn(),
    sustainOff: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn(),
    setReleaseTime: vi.fn(),
    playErrorTone: vi.fn(),
    dispose: vi.fn(),
    _setCurrentTime(t: number) {
      currentTime = t;
    },
  };
}

// ─── Tests ───────────────────────────────────────

describe("AudioScheduler", () => {
  let engine: MockAudioEngine;
  let scheduler: AudioScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = createMockEngine(0);
    scheduler = new AudioScheduler(engine);
  });

  afterEach(() => {
    scheduler.dispose();
    vi.useRealTimers();
  });

  // ─── setSong ──────────────────────────────

  describe("setSong", () => {
    test("initializes track cursors to zero for each track", () => {
      const s = song([track([note(1, 0.5)]), track([note(2, 0.5)])]);
      scheduler.setSong(s);
      // Verify indirectly: starting at time 0 should work without error
      scheduler.start(0);
      expect(engine.noteOn).not.toHaveBeenCalled(); // no notes in look-ahead window at t=0 (first note at t=1)
    });

    test("subsequent setSong replaces previous song", () => {
      const s1 = song([track([note(0, 0.5, 60)])]);
      const s2 = song([track([note(0, 0.5, 72)])]);
      scheduler.setSong(s1);
      scheduler.setSong(s2);
      scheduler.start(0);
      vi.advanceTimersByTime(25);
      // Should schedule note from s2 (midi=72), not s1 (midi=60)
      expect(engine.noteOn).toHaveBeenCalledWith(72, 80, expect.any(Number));
      expect(engine.noteOn).not.toHaveBeenCalledWith(
        60,
        80,
        expect.any(Number),
      );
    });
  });

  // ─── start / stop ─────────────────────────

  describe("start / stop", () => {
    test("start creates an interval that fires tick", () => {
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0);

      // Before timer fires, no notes scheduled
      expect(engine.noteOn).not.toHaveBeenCalled();

      // Advance timer by one interval (25ms)
      vi.advanceTimersByTime(25);
      expect(engine.noteOn).toHaveBeenCalled();
    });

    test("stop clears interval and calls allNotesOff", () => {
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      scheduler.stop();

      expect(engine.allNotesOff).toHaveBeenCalledTimes(1);

      // Further timer advances should not trigger more noteOn calls
      engine.noteOn.mockClear();
      vi.advanceTimersByTime(100);
      expect(engine.noteOn).not.toHaveBeenCalled();
    });

    test("stop followed by start works correctly", () => {
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      scheduler.stop();
      engine.noteOn.mockClear();
      engine.allNotesOff.mockClear();

      // Start again
      scheduler.start(0);
      vi.advanceTimersByTime(25);
      expect(engine.noteOn).toHaveBeenCalled();
    });

    test("start without setSong does nothing", () => {
      scheduler.start(0);
      vi.advanceTimersByTime(100);
      expect(engine.noteOn).not.toHaveBeenCalled();
    });

    test("start without audioContext does nothing", () => {
      const noCtxEngine: IAudioEngine = {
        ...engine,
        audioContext: null,
      };
      const s = new AudioScheduler(noCtxEngine);
      s.setSong(song([track([note(0, 0.5)])]));
      s.start(0);
      vi.advanceTimersByTime(100);
      expect(noCtxEngine.noteOn).not.toHaveBeenCalled();
      s.dispose();
    });

    test("calling start twice clears previous interval", () => {
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      scheduler.start(0); // should clear old interval

      // Only one set of scheduling should be active
      vi.advanceTimersByTime(25);
      // noteOn should be called exactly once — not duplicated by two intervals
      expect(engine.noteOn).toHaveBeenCalledTimes(1);
    });
  });

  // ─── seek ─────────────────────────────────

  describe("seek", () => {
    test("seek calls allNotesOff", () => {
      const s = song([track([note(0, 0.5), note(1, 0.5), note(2, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      engine.allNotesOff.mockClear();

      scheduler.seek(1.5);
      expect(engine.allNotesOff).toHaveBeenCalledTimes(1);
    });

    test("seek to middle skips earlier notes", () => {
      const notes = [
        note(0, 0.2, 60),
        note(0.5, 0.2, 62),
        note(1.5, 0.2, 64),
        note(2, 0.2, 65),
      ];
      const s = song([track(notes)]);
      scheduler.setSong(s);

      // Seek to t=1.5 — notes at t=0 and t=0.5 should be skipped
      scheduler.start(1.5);
      vi.advanceTimersByTime(25);

      // midi 64 at t=1.5 should be scheduled (within look-ahead)
      expect(engine.noteOn).toHaveBeenCalledWith(64, 80, expect.any(Number));
      // midi 60 and 62 should NOT be scheduled
      expect(engine.noteOn).not.toHaveBeenCalledWith(
        60,
        80,
        expect.any(Number),
      );
      expect(engine.noteOn).not.toHaveBeenCalledWith(
        62,
        80,
        expect.any(Number),
      );
    });

    test("seek beyond song duration handles safely", () => {
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      engine.noteOn.mockClear();

      // Seek past end of song
      scheduler.seek(999);
      vi.advanceTimersByTime(100);
      // No notes should be scheduled since cursor is past all notes
      expect(engine.noteOn).not.toHaveBeenCalled();
    });

    test("seek without song does nothing", () => {
      scheduler.seek(5);
      // Should not throw
      expect(engine.allNotesOff).not.toHaveBeenCalled();
    });

    test("seek while stopped does not restart interval", () => {
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      // Don't start — just seek
      scheduler.seek(0);
      engine.noteOn.mockClear();
      vi.advanceTimersByTime(100);
      expect(engine.noteOn).not.toHaveBeenCalled();
    });

    test("seek while playing restarts scheduling from new position", () => {
      const notes = [note(0, 0.2, 60), note(5, 0.2, 72)];
      const s = song([track(notes)]);
      scheduler.setSong(s);
      scheduler.start(0);
      vi.advanceTimersByTime(25);
      engine.noteOn.mockClear();

      // Seek to t=5 where note midi=72 exists
      scheduler.seek(5);
      vi.advanceTimersByTime(25);
      expect(engine.noteOn).toHaveBeenCalledWith(72, 80, expect.any(Number));
    });
  });

  // ─── _tick scheduling (indirect) ──────────

  describe("tick scheduling", () => {
    test("schedules noteOn and noteOff with correct AudioContext times", () => {
      engine._setCurrentTime(10); // audioContext.currentTime = 10
      const s = song([track([note(0, 0.5, 60, 100)])]);
      scheduler.setSong(s);
      scheduler.start(0); // startAudioTime = 10, seekOffset = 0
      vi.advanceTimersByTime(25);

      // audioTime = startAudioTime + (note.time - seekOffset) = 10 + 0 = 10
      // clampedOnTime = max(10, 10) = 10
      expect(engine.noteOn).toHaveBeenCalledWith(60, 100, 10);
      // offTime = 10 + (0 + 0.5 - 0) = 10.5
      expect(engine.noteOff).toHaveBeenCalledWith(60, 10.5);
    });

    test("does not schedule notes beyond look-ahead window", () => {
      engine._setCurrentTime(0);
      // Look-ahead is 0.1s by default; note at t=0.5 is outside window
      const s = song([track([note(0.5, 0.2, 60)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      vi.advanceTimersByTime(25);

      expect(engine.noteOn).not.toHaveBeenCalled();
    });

    test("schedules notes within look-ahead window", () => {
      engine._setCurrentTime(0);
      // Note at t=0.05 is within 0.1s look-ahead
      const s = song([track([note(0.05, 0.2, 60)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      vi.advanceTimersByTime(25);

      expect(engine.noteOn).toHaveBeenCalledWith(60, 80, expect.any(Number));
    });

    test("advancing time makes later notes come into look-ahead window", () => {
      engine._setCurrentTime(0);
      const s = song([track([note(0.5, 0.2, 72)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      vi.advanceTimersByTime(25);
      expect(engine.noteOn).not.toHaveBeenCalled();

      // Simulate audioContext time advancing to 0.45
      // songTime = 0.45 - 0 + 0 = 0.45; horizon = 0.55 → note at 0.5 is within
      engine._setCurrentTime(0.45);
      vi.advanceTimersByTime(25);
      expect(engine.noteOn).toHaveBeenCalledWith(72, 80, expect.any(Number));
    });

    test("clamps noteOn time to current time (no scheduling in the past)", () => {
      engine._setCurrentTime(5);
      // Note at t=0 with seekOffset=0 would be scheduled at audioTime=5+0=5
      // But let's test with a scenario where audioTime < ctx.currentTime
      const s = song([track([note(0, 0.5, 60)])]);
      scheduler.setSong(s);
      scheduler.start(0); // startAudioTime = 5
      // Advance currentTime past the note's ideal audioTime
      engine._setCurrentTime(5.05);
      vi.advanceTimersByTime(25);

      // audioTime = 5 + 0 = 5, but currentTime is 5.05
      // clampedOnTime = max(5, 5.05) = 5.05
      expect(engine.noteOn).toHaveBeenCalledWith(60, 80, 5.05);
    });

    test("does not schedule the same note twice", () => {
      engine._setCurrentTime(0);
      const s = song([track([note(0.02, 0.3, 60)])]);
      scheduler.setSong(s);
      scheduler.start(0);

      // First tick picks up the note
      vi.advanceTimersByTime(25);
      expect(engine.noteOn).toHaveBeenCalledTimes(1);

      // Second tick should not re-schedule it (cursor has advanced)
      vi.advanceTimersByTime(25);
      expect(engine.noteOn).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getCurrentTime ───────────────────────

  describe("getCurrentTime", () => {
    test("returns null when not playing", () => {
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      expect(scheduler.getCurrentTime()).toBeNull();
    });

    test("returns correct song time while playing", () => {
      engine._setCurrentTime(10);
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0); // startAudioTime = 10, seekOffset = 0

      engine._setCurrentTime(12);
      // songTime = 12 - 10 + 0 = 2
      expect(scheduler.getCurrentTime()).toBe(2);
    });

    test("returns correct song time after seek", () => {
      engine._setCurrentTime(10);
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0);

      engine._setCurrentTime(11);
      scheduler.seek(5); // startAudioTime = 11, seekOffset = 5
      engine._setCurrentTime(13);
      // songTime = 13 - 11 + 5 = 7
      expect(scheduler.getCurrentTime()).toBe(7);
    });
  });

  // ─── Edge cases ───────────────────────────

  describe("edge cases", () => {
    test("empty song (no tracks)", () => {
      const s = song([]);
      scheduler.setSong(s);
      scheduler.start(0);
      vi.advanceTimersByTime(100);
      // Should not throw, no notes scheduled
      expect(engine.noteOn).not.toHaveBeenCalled();
    });

    test("single-note song", () => {
      const s = song([track([note(0, 1, 60, 127)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      vi.advanceTimersByTime(25);
      expect(engine.noteOn).toHaveBeenCalledTimes(1);
      expect(engine.noteOn).toHaveBeenCalledWith(60, 127, expect.any(Number));
      expect(engine.noteOff).toHaveBeenCalledTimes(1);
    });

    test("multi-track parallel scheduling", () => {
      const t1 = track([note(0, 0.5, 60)], "Track 1");
      const t2 = track([note(0, 0.5, 64)], "Track 2");
      const t3 = track([note(0, 0.5, 67)], "Track 3");
      const s = song([t1, t2, t3]);
      scheduler.setSong(s);
      scheduler.start(0);
      vi.advanceTimersByTime(25);

      // All three notes from different tracks should be scheduled
      expect(engine.noteOn).toHaveBeenCalledTimes(3);
      expect(engine.noteOn).toHaveBeenCalledWith(60, 80, expect.any(Number));
      expect(engine.noteOn).toHaveBeenCalledWith(64, 80, expect.any(Number));
      expect(engine.noteOn).toHaveBeenCalledWith(67, 80, expect.any(Number));
    });

    test("track with empty notes array", () => {
      const s = song([track([])]);
      scheduler.setSong(s);
      scheduler.start(0);
      vi.advanceTimersByTime(100);
      expect(engine.noteOn).not.toHaveBeenCalled();
    });

    test("dispose cleans up all state", () => {
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      scheduler.dispose();

      // allNotesOff called via stop()
      expect(engine.allNotesOff).toHaveBeenCalled();

      // No further scheduling
      engine.noteOn.mockClear();
      vi.advanceTimersByTime(100);
      expect(engine.noteOn).not.toHaveBeenCalled();
    });

    test("dispose is safe to call multiple times", () => {
      scheduler.dispose();
      scheduler.dispose();
      // Should not throw
    });

    test("setSpeed during playback does not cause time discontinuity", () => {
      engine._setCurrentTime(10);
      const s = song([track([note(5, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0); // startAudioTime=10, seekOffset=0, speed=1.0

      // Advance to audioTime=12 → songTime = (12-10)*1.0 + 0 = 2.0
      engine._setCurrentTime(12);
      scheduler.setSpeed(0.5);

      // Immediately after setSpeed, getCurrentTime should still read ~2.0
      expect(scheduler.getCurrentTime()).toBeCloseTo(2.0, 6);

      // Advance 2 more audio-seconds at 0.5x → 1.0 song-second
      engine._setCurrentTime(14);
      expect(scheduler.getCurrentTime()).toBeCloseTo(3.0, 6);
    });

    test("setSpeed while stopped does not re-anchor timing", () => {
      const s = song([track([note(1, 0.5)])]);
      scheduler.setSong(s);
      scheduler.setSpeed(0.5);
      // No crash, no timing state to corrupt
      scheduler.start(0);
      engine._setCurrentTime(2); // 2 audio-seconds * 0.5x = 1.0 song-second
      expect(scheduler.getCurrentTime()).toBeCloseTo(1.0, 6);
    });

    test("custom config overrides defaults", () => {
      const customScheduler = new AudioScheduler(engine, {
        lookAheadSeconds: 0.5,
        intervalMs: 50,
      });
      // Note at t=0.3 should be within 0.5s look-ahead
      const s = song([track([note(0.3, 0.2, 60)])]);
      customScheduler.setSong(s);
      customScheduler.start(0);
      vi.advanceTimersByTime(50); // custom interval
      expect(engine.noteOn).toHaveBeenCalledWith(60, 80, expect.any(Number));
      customScheduler.dispose();
    });

    // ─── R1-01/R1-02: setSpeed calls allNotesOff ───
    test("setSpeed during playback calls allNotesOff to flush in-flight notes", () => {
      engine._setCurrentTime(0);
      const s = song([track([note(0, 0.5, 60)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      vi.advanceTimersByTime(25); // schedule the note
      engine.allNotesOff.mockClear();

      engine._setCurrentTime(0.03);
      scheduler.setSpeed(0.5);

      // allNotesOff must be called to prevent ghost duplicates
      expect(engine.allNotesOff).toHaveBeenCalledTimes(1);
    });

    test("setSpeed while stopped does NOT call allNotesOff", () => {
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.setSpeed(0.5);
      expect(engine.allNotesOff).not.toHaveBeenCalled();
    });

    // ─── R1-03: Look-ahead window at low speed ───
    test("look-ahead window does not collapse at low speed", () => {
      engine._setCurrentTime(0);
      // Note at t=0.05 — within 0.1s look-ahead in song time
      const s = song([track([note(0.05, 0.2, 60)])]);
      scheduler.setSong(s);
      scheduler.setSpeed(0.25);
      scheduler.start(0);
      vi.advanceTimersByTime(25);

      // At speed=0.25, the old formula gave horizon = songTime + 0.1*0.25 = 0.025
      // which would miss note at t=0.05. The fix uses lookAheadSeconds directly.
      expect(engine.noteOn).toHaveBeenCalledWith(60, 80, expect.any(Number));
    });

    // ─── R1-04: Stale note skip uses <= ───
    test("does not schedule ghost note when noteEnd equals songTime", () => {
      engine._setCurrentTime(10);
      // Note at t=0, duration=0.5, ends at t=0.5
      // Start at songTime=0.5 — note should be fully elapsed
      const s = song([track([note(0, 0.5, 60)])]);
      scheduler.setSong(s);
      scheduler.start(0.5);
      vi.advanceTimersByTime(25);

      // With the old < check, this note would be scheduled as a ghost
      expect(engine.noteOn).not.toHaveBeenCalled();
    });

    // ─── R1-05: Short note duration not inflated ───
    test("short note at high speed uses scaled duration, not hardcoded minimum", () => {
      engine._setCurrentTime(10);
      // 5ms note at speed=2.0 → scaled duration = 2.5ms
      // Old code would use 10ms minimum, new code uses min(2.5ms, 10ms) = 2.5ms
      const s = song([track([note(0, 0.005, 60, 100)])]);
      scheduler.setSong(s);
      scheduler.setSpeed(2.0);
      scheduler.start(0);
      vi.advanceTimersByTime(25);

      expect(engine.noteOn).toHaveBeenCalledTimes(1);
      expect(engine.noteOff).toHaveBeenCalledTimes(1);

      const onTime = engine.noteOn.mock.calls[0][2] as number;
      const offTime = engine.noteOff.mock.calls[0][1] as number;
      const gap = offTime - onTime;

      // Gap should be close to scaled duration (0.005/2.0 = 0.0025),
      // NOT the old hardcoded 0.01
      expect(gap).toBeLessThan(0.01);
      expect(gap).toBeGreaterThan(0);
    });

    // ─── R1-08: speed=0 guard ───
    test("setSpeed(0) is silently rejected", () => {
      engine._setCurrentTime(0);
      const s = song([track([note(0, 0.5)])]);
      scheduler.setSong(s);
      scheduler.start(0);
      scheduler.setSpeed(0);

      // Speed should remain at default (1.0) — getCurrentTime uses speed
      engine._setCurrentTime(1);
      expect(scheduler.getCurrentTime()).toBeCloseTo(1.0, 6);
    });

    test("setSpeed(NaN) is silently rejected", () => {
      scheduler.setSpeed(NaN);
      // Should not throw
    });

    test("setSpeed(-1) is silently rejected", () => {
      scheduler.setSpeed(-1);
      // Should not throw
    });
  });
});
