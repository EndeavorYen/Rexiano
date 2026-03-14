import { describe, it, expect, beforeEach, vi } from "vitest";
import { WaitMode } from "./WaitMode";
import type { ParsedTrack } from "../midi/types";

function makeTracks(
  notes: Array<{ midi: number; time: number }>,
): ParsedTrack[] {
  return [
    {
      name: "Right Hand",
      instrument: "Piano",
      channel: 0,
      notes: notes.map((n) => ({
        midi: n.midi,
        name: `N${n.midi}`,
        time: n.time,
        duration: 0.5,
        velocity: 80,
      })),
    },
  ];
}

describe("WaitMode", () => {
  let wm: WaitMode;

  beforeEach(() => {
    wm = new WaitMode(200); // +/-200ms tolerance
  });

  it("starts in idle state", () => {
    expect(wm.state).toBe("idle");
  });

  it("tick returns true when idle (no blocking)", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    expect(wm.tick(0.5)).toBe(true);
  });

  it("transitions to waiting when a note is within tolerance", () => {
    const onWait = vi.fn();
    wm.setCallbacks({ onWait });
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    // At time 0.85 -> note at 1.0 is within +/-200ms (0.8-1.2)
    const result = wm.tick(0.85);
    expect(result).toBe(false);
    expect(wm.state).toBe("waiting");
    expect(onWait).toHaveBeenCalledOnce();
    expect(wm.targetNotes.has(60)).toBe(true);
  });

  it("resumes when correct note is played", () => {
    const onResume = vi.fn();
    wm.setCallbacks({ onResume });
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    wm.tick(0.9);
    expect(wm.state).toBe("waiting");

    const resumed = wm.checkInput(new Set([60]));
    expect(resumed).toBe(true);
    expect(wm.state).toBe("playing");
    expect(onResume).toHaveBeenCalledOnce();
  });

  it("does not resume when wrong note is played", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();
    wm.tick(0.9);

    const resumed = wm.checkInput(new Set([62]));
    expect(resumed).toBe(false);
    expect(wm.state).toBe("waiting");
  });

  it("handles chords -- all notes must be pressed", () => {
    const tracks: ParsedTrack[] = [
      {
        name: "RH",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 1.0, duration: 0.5, velocity: 80 },
          { midi: 64, name: "E4", time: 1.0, duration: 0.5, velocity: 80 },
          { midi: 67, name: "G4", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
    ];

    wm.init(tracks, new Set([0]));
    wm.start();
    wm.tick(1.0);

    // Only 2 of 3 notes pressed
    expect(wm.checkInput(new Set([60, 64]))).toBe(false);
    expect(wm.state).toBe("waiting");

    // All 3 notes pressed
    expect(wm.checkInput(new Set([60, 64, 67]))).toBe(true);
    expect(wm.state).toBe("playing");
  });

  it("marks notes as miss when passed beyond tolerance", () => {
    const onMiss = vi.fn();
    wm.setCallbacks({ onMiss });
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    // Time is well past the note + tolerance (1.0 + 0.2 = 1.2)
    wm.tick(1.5);
    expect(onMiss).toHaveBeenCalledWith(60, 1.0);
  });

  it("ignores tracks not in activeTracks", () => {
    const tracks: ParsedTrack[] = [
      {
        name: "RH",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
      {
        name: "LH",
        instrument: "Piano",
        channel: 1,
        notes: [
          { midi: 48, name: "C3", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
    ];

    // Only track 0 is active
    wm.init(tracks, new Set([0]));
    wm.start();
    wm.tick(1.0);

    // Should only wait for midi 60 (track 0), not 48 (track 1)
    expect(wm.targetNotes.has(60)).toBe(true);
    expect(wm.targetNotes.has(48)).toBe(false);
  });

  it("tick returns true when no notes are near", () => {
    wm.init(makeTracks([{ midi: 60, time: 5.0 }]), new Set([0]));
    wm.start();

    expect(wm.tick(0.5)).toBe(true);
    expect(wm.state).toBe("playing");
  });

  it("checkInput returns false when not in waiting state", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    expect(wm.checkInput(new Set([60]))).toBe(false);
  });

  it("reset() clears all state", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();
    wm.tick(1.0);
    expect(wm.state).toBe("waiting");

    wm.reset();
    expect(wm.state).toBe("idle");
    expect(wm.targetNotes.size).toBe(0);
    expect(wm.noteResults.size).toBe(0);
  });

  it("stop() returns to idle", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();
    wm.stop();
    expect(wm.state).toBe("idle");
  });

  it("clearCallbacks() prevents callbacks from firing after disposal", () => {
    const onWait = vi.fn();
    const onMiss = vi.fn();
    wm.setCallbacks({ onWait, onMiss });
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    // Verify callbacks fire before clearing
    wm.tick(0.85); // note at 1.0 within +/-200ms -> onWait fires
    expect(onWait).toHaveBeenCalledOnce();

    // Clear and reset for a fresh pass
    wm.clearCallbacks();
    wm.reset();
    wm.start();

    // Same tick -- note is again in window, but callbacks must not fire
    wm.tick(0.85);
    expect(onWait).toHaveBeenCalledOnce(); // still only once from before

    // Past tolerance -- onMiss must also not fire
    wm.reset();
    wm.start();
    wm.tick(1.5);
    expect(onMiss).not.toHaveBeenCalled();
  });

  // ── Latency compensation tests (R2-007: passed as parameter) ───────

  it("latency compensation shifts detection window backward", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    // With 50ms latency, adjustedTime = 0.85 - 0.05 = 0.80, window = [0.60, 1.00]
    // note at 1.0 is exactly at boundary -> pending
    const result = wm.tick(0.85, 50);
    expect(result).toBe(false);
    expect(wm.state).toBe("waiting");
  });

  it("latency compensation delays miss detection", () => {
    // With 100ms latency: adjustedTime = 1.25 - 0.10 = 1.15, window = [0.95, 1.35]
    // note at 1.0 is within window -> pending (not missed yet)
    const onMiss = vi.fn();
    wm.setCallbacks({ onMiss });
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    wm.tick(1.25, 100);
    expect(onMiss).not.toHaveBeenCalled();
    expect(wm.state).toBe("waiting");
  });

  it("zero latency compensation behaves the same as default", () => {
    const onWait = vi.fn();
    wm.setCallbacks({ onWait });
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();

    // At time 0.85 -> note at 1.0 is within +/-200ms
    wm.tick(0.85, 0);
    expect(wm.state).toBe("waiting");
    expect(onWait).toHaveBeenCalledOnce();
  });

  // ── toleranceMs getter/setter (R2-007) ─────────────────

  it("toleranceMs getter returns current value", () => {
    expect(wm.toleranceMs).toBe(200);
  });

  it("setToleranceMs clamps to [50, 500]", () => {
    wm.setToleranceMs(10);
    expect(wm.toleranceMs).toBe(50);
    wm.setToleranceMs(999);
    expect(wm.toleranceMs).toBe(500);
    wm.setToleranceMs(300);
    expect(wm.toleranceMs).toBe(300);
  });

  // ── R1-01: Negative adjustedTime at song start ─────────────────

  it("R1-01: clamps adjustedTime to 0 when latencyCompensation exceeds currentTime", () => {
    // Note at time 0.1 (very early in song), tolerance ±200ms -> window [0, 0.3]
    wm.init(makeTracks([{ midi: 60, time: 0.1 }]), new Set([0]));
    wm.start();

    // currentTime=0.05, latency=200ms -> raw adjustedTime = 0.05 - 0.2 = -0.15
    // With clamp: adjustedTime = 0, window = [-0.2, 0.2] -> note at 0.1 is within window
    const result = wm.tick(0.05, 200);
    expect(result).toBe(false);
    expect(wm.state).toBe("waiting");
    expect(wm.targetNotes.has(60)).toBe(true);
  });

  it("R1-01: does not falsely miss early notes with high latency compensation", () => {
    const onMiss = vi.fn();
    wm.setCallbacks({ onMiss });
    // Note at 0.05s, tolerance ±200ms
    wm.init(makeTracks([{ midi: 60, time: 0.05 }]), new Set([0]));
    wm.start();

    // currentTime=0.0, latency=200ms -> clamped adjustedTime = 0
    // window = [-0.2, 0.2], note at 0.05 is within window -> pending, not miss
    wm.tick(0.0, 200);
    expect(onMiss).not.toHaveBeenCalled();
    expect(wm.state).toBe("waiting");
  });

  // ── R1-03: checkInput rejects superset of target notes ─────────

  it("R1-03: rejects input when extra keys are held beyond target notes", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();
    wm.tick(1.0);
    expect(wm.state).toBe("waiting");

    // Target is {60}, user holds {60, 62} -> should reject (extra key)
    expect(wm.checkInput(new Set([60, 62]))).toBe(false);
    expect(wm.state).toBe("waiting");

    // Exact match should still work
    expect(wm.checkInput(new Set([60]))).toBe(true);
    expect(wm.state).toBe("playing");
  });

  it("R1-03: rejects input with many extra keys on a chord target", () => {
    const tracks: ParsedTrack[] = [
      {
        name: "RH",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 1.0, duration: 0.5, velocity: 80 },
          { midi: 64, name: "E4", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
    ];
    wm.init(tracks, new Set([0]));
    wm.start();
    wm.tick(1.0);

    // Target is {60, 64}, user holds {60, 64, 67, 72} -> too many keys
    expect(wm.checkInput(new Set([60, 64, 67, 72]))).toBe(false);
    expect(wm.state).toBe("waiting");
  });

  // ── R1-05: reset() clears _pendingMidis ─────────────────────────

  it("R1-05: reset() clears pendingMidis so stale state does not persist", () => {
    wm.init(makeTracks([{ midi: 60, time: 1.0 }]), new Set([0]));
    wm.start();
    wm.tick(1.0); // enters waiting, _pendingMidis has {60}
    expect(wm.state).toBe("waiting");

    // Reset while waiting (e.g. loop restart)
    wm.reset();
    expect(wm.state).toBe("idle");

    // Re-init with a different track, start fresh
    wm.init(makeTracks([{ midi: 72, time: 2.0 }]), new Set([0]));
    wm.start();

    // Tick before the note's window — should pass through (no stale pending)
    expect(wm.tick(0.5)).toBe(true);
    expect(wm.state).toBe("playing");
  });

  // ── R1-06: Same MIDI in two tracks → deduplicated callbacks ─────

  it("R1-06: same MIDI in two tracks fires onHit only once", () => {
    const onHit = vi.fn();
    wm.setCallbacks({ onHit });

    const tracks: ParsedTrack[] = [
      {
        name: "RH",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
      {
        name: "LH",
        instrument: "Piano",
        channel: 1,
        notes: [
          { midi: 60, name: "C4", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
    ];

    // Both tracks active, same MIDI 60 at same time
    wm.init(tracks, new Set([0, 1]));
    wm.start();
    wm.tick(1.0);
    expect(wm.state).toBe("waiting");

    // Play the note — should match (only one unique MIDI in target)
    wm.checkInput(new Set([60]));
    expect(wm.state).toBe("playing");

    // onHit should fire exactly once despite two track entries
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onHit).toHaveBeenCalledWith(60, 1.0);

    // Both track entries should be marked as "hit" in noteResults
    expect(wm.noteResults.get("0:0")).toBe("hit");
    expect(wm.noteResults.get("1:0")).toBe("hit");
  });

  it("R1-06: same MIDI in two tracks fires onMiss only once when missed", () => {
    const onMiss = vi.fn();
    wm.setCallbacks({ onMiss });

    const tracks: ParsedTrack[] = [
      {
        name: "RH",
        instrument: "Piano",
        channel: 0,
        notes: [
          { midi: 60, name: "C4", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
      {
        name: "LH",
        instrument: "Piano",
        channel: 1,
        notes: [
          { midi: 60, name: "C4", time: 1.0, duration: 0.5, velocity: 80 },
        ],
      },
    ];

    wm.init(tracks, new Set([0, 1]));
    wm.start();

    // Time well past tolerance window -> both entries missed
    wm.tick(1.5);

    // R1-02 fix: direct miss path now deduplicates by MIDI, matching _markPendingAs.
    // onMiss should fire exactly once for MIDI 60, not once per track.
    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(onMiss).toHaveBeenCalledWith(60, 1.0);

    // Both track entries should still be marked as "miss" in noteResults
    expect(wm.noteResults.get("0:0")).toBe("miss");
    expect(wm.noteResults.get("1:0")).toBe("miss");
  });

  // ── R1-02: Disputed — tickerLoop freezes time during wait ────────

  it("R1-02: time does not advance during wait, so next note is not falsely missed", () => {
    // This test verifies the design: tickerLoop freezes currentTime during wait.
    // Simulating: note1 triggers wait, user takes time, resumes, note2 is reachable.
    const onMiss = vi.fn();
    const onWait = vi.fn();
    const onResume = vi.fn();
    wm.setCallbacks({ onMiss, onWait, onResume });

    wm.init(
      makeTracks([
        { midi: 60, time: 1.0 },
        { midi: 62, time: 1.3 },
      ]),
      new Set([0]),
    );
    wm.start();

    // Tick at 0.9 — note at 1.0 enters window, state -> waiting
    wm.tick(0.9);
    expect(wm.state).toBe("waiting");
    expect(onWait).toHaveBeenCalledTimes(1);

    // Simulate: user takes 5 seconds, but tickerLoop freezes time at 0.9.
    // Multiple ticks at the SAME time (time is frozen)
    wm.tick(0.9); // returns false, still waiting — no time advancement
    wm.tick(0.9);

    // User finally plays the note
    wm.checkInput(new Set([60]));
    expect(wm.state).toBe("playing");

    // Next tick at 0.9 (same frozen time) — note at 1.3 not yet in window
    // (window is [0.7, 1.1], note 1.3 > 1.1)
    const result = wm.tick(0.9);
    expect(result).toBe(true); // no new pending notes
    expect(onMiss).not.toHaveBeenCalled(); // note 62 NOT missed
  });
});
