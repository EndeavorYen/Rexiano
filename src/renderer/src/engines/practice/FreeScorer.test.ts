import { describe, it, expect, beforeEach, vi } from "vitest";
import { FreeScorer } from "./FreeScorer";
import type { ParsedTrack } from "../midi/types";

function makeTrack(notes: { midi: number; time: number }[]): ParsedTrack {
  return {
    name: "Test",
    instrument: "Piano",
    channel: 0,
    notes: notes.map((n) => ({
      midi: n.midi,
      name: `N${n.midi}`,
      time: n.time,
      duration: 0.5,
      velocity: 80,
    })),
  };
}

describe("FreeScorer", () => {
  let scorer: FreeScorer;
  const onHit = vi.fn();
  const onMiss = vi.fn();

  beforeEach(() => {
    scorer = new FreeScorer(200, 100);
    onHit.mockClear();
    onMiss.mockClear();
    scorer.setCallbacks({ onHit, onMiss });
  });

  it("starts in stopped state", () => {
    expect(scorer.isRunning).toBe(false);
  });

  it("does not fire callbacks when not running", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.tick(2.0);
    scorer.checkInput(new Set([60]), 1.0);
    expect(onHit).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();
  });

  it("records a hit when MIDI input matches a note within tolerance", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.start();

    // Press note 60 at time 1.05 (within +-200ms)
    scorer.checkInput(new Set([60]), 1.05);
    expect(onHit).toHaveBeenCalledWith(60, 1.0);
    expect(onMiss).not.toHaveBeenCalled();
  });

  it("does not record a hit when note is outside tolerance", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.start();

    // Press note 60 at time 1.5 (outside +-200ms + 100ms grace)
    scorer.checkInput(new Set([60]), 1.5);
    expect(onHit).not.toHaveBeenCalled();
  });

  it("records a miss when note passes the grace window without being played", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.start();

    // Advance time well past the note + tolerance + grace
    scorer.tick(1.5);
    expect(onMiss).toHaveBeenCalledWith(60, 1.0);
  });

  it("does not double-count a note already judged as hit", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.start();

    scorer.checkInput(new Set([60]), 1.0);
    expect(onHit).toHaveBeenCalledTimes(1);

    // Tick past the grace window — should NOT fire miss
    scorer.tick(1.5);
    expect(onMiss).not.toHaveBeenCalled();
  });

  it("does not double-count a note already judged as miss", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.start();

    scorer.tick(1.5); // miss
    expect(onMiss).toHaveBeenCalledTimes(1);

    // Another tick — should NOT fire again
    scorer.tick(2.0);
    expect(onMiss).toHaveBeenCalledTimes(1);
  });

  it("handles multiple notes in sequence", () => {
    const track = makeTrack([
      { midi: 60, time: 1.0 },
      { midi: 62, time: 2.0 },
      { midi: 64, time: 3.0 },
    ]);
    scorer.init([track], new Set([0]));
    scorer.start();

    // Hit the first note
    scorer.checkInput(new Set([60]), 1.0);
    expect(onHit).toHaveBeenCalledTimes(1);

    // Miss the second note
    scorer.tick(2.5);
    expect(onMiss).toHaveBeenCalledTimes(1);
    expect(onMiss).toHaveBeenCalledWith(62, 2.0);

    // Hit the third note
    scorer.checkInput(new Set([64]), 3.0);
    expect(onHit).toHaveBeenCalledTimes(2);
    expect(onHit).toHaveBeenCalledWith(64, 3.0);
  });

  it("only scores notes in active tracks", () => {
    const track0 = makeTrack([{ midi: 60, time: 1.0 }]);
    const track1 = makeTrack([{ midi: 62, time: 1.0 }]);
    scorer.init([track0, track1], new Set([1])); // only track 1 active
    scorer.start();

    // Press note from track 0 (inactive) — should not register
    scorer.checkInput(new Set([60]), 1.0);
    expect(onHit).not.toHaveBeenCalled();

    // Press note from track 1 (active)
    scorer.checkInput(new Set([62]), 1.0);
    expect(onHit).toHaveBeenCalledWith(62, 1.0);

    // Tick past — track 0's note should not be missed since it's inactive
    scorer.tick(1.5);
    expect(onMiss).not.toHaveBeenCalled();
  });

  it("reset() allows re-judging notes on loop restart", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.start();

    scorer.checkInput(new Set([60]), 1.0);
    expect(onHit).toHaveBeenCalledTimes(1);

    scorer.reset();

    // Same note can be judged again after reset
    scorer.checkInput(new Set([60]), 1.0);
    expect(onHit).toHaveBeenCalledTimes(2);
  });

  it("stop() prevents further scoring", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.start();
    scorer.stop();

    scorer.checkInput(new Set([60]), 1.0);
    scorer.tick(1.5);
    expect(onHit).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();
  });

  it("clearCallbacks() prevents callbacks from firing", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.start();
    scorer.clearCallbacks();

    scorer.checkInput(new Set([60]), 1.0);
    scorer.tick(2.0);
    expect(onHit).not.toHaveBeenCalled();
    expect(onMiss).not.toHaveBeenCalled();
  });

  it("ignores empty activeNotes input", () => {
    const track = makeTrack([{ midi: 60, time: 1.0 }]);
    scorer.init([track], new Set([0]));
    scorer.start();

    scorer.checkInput(new Set(), 1.0);
    expect(onHit).not.toHaveBeenCalled();
  });
});
