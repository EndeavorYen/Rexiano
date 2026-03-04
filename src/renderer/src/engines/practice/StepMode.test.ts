import { describe, it, expect, beforeEach } from "vitest";
import { StepMode } from "./StepMode";
import type { ParsedTrack, ParsedNote } from "../midi/types";

function makeNote(midi: number, time: number, duration = 0.5): ParsedNote {
  return {
    midi,
    name: `N${midi}`,
    time,
    duration,
    velocity: 80,
  };
}

function makeTrack(notes: ParsedNote[]): ParsedTrack {
  return {
    name: "Track 1",
    instrument: "Piano",
    channel: 0,
    notes,
  };
}

describe("StepMode", () => {
  let step: StepMode;

  beforeEach(() => {
    step = new StepMode();
  });

  it("should initialize with zero steps when no tracks set", () => {
    expect(step.totalSteps).toBe(0);
    expect(step.currentIndex).toBe(0);
    expect(step.isAtEnd).toBe(true);
    expect(step.getCurrentNotes()).toBeNull();
  });

  it("should build steps from a single track", () => {
    const track = makeTrack([
      makeNote(60, 0.0),
      makeNote(64, 0.5),
      makeNote(67, 1.0),
    ]);
    step.setTracks([track], new Set([0]));

    expect(step.totalSteps).toBe(3);
    expect(step.currentIndex).toBe(0);
    expect(step.isAtEnd).toBe(false);
  });

  it("should advance through notes one at a time", () => {
    const track = makeTrack([
      makeNote(60, 0.0),
      makeNote(64, 0.5),
      makeNote(67, 1.0),
    ]);
    step.setTracks([track], new Set([0]));

    const first = step.getCurrentNotes();
    expect(first?.notes[0].midi).toBe(60);

    const second = step.advance();
    expect(second?.notes[0].midi).toBe(64);
    expect(step.currentIndex).toBe(1);

    const third = step.advance();
    expect(third?.notes[0].midi).toBe(67);
    expect(step.currentIndex).toBe(2);

    // Advance past end
    const past = step.advance();
    expect(past).toBeNull();
    expect(step.isAtEnd).toBe(true);
  });

  it("should group simultaneous notes as a chord (within 80ms window)", () => {
    const track = makeTrack([
      makeNote(60, 0.0),
      makeNote(64, 0.03), // within 80ms of first note
      makeNote(67, 0.05), // within 80ms of first note
      makeNote(72, 1.0), // separate step
    ]);
    step.setTracks([track], new Set([0]));

    expect(step.totalSteps).toBe(2);

    const chord = step.getCurrentNotes();
    expect(chord?.notes).toHaveLength(3);
    expect(chord?.notes.map((n) => n.midi)).toEqual([60, 64, 67]);

    const single = step.advance();
    expect(single?.notes).toHaveLength(1);
    expect(single?.notes[0].midi).toBe(72);
  });

  it("should reset to the beginning", () => {
    const track = makeTrack([
      makeNote(60, 0.0),
      makeNote(64, 0.5),
    ]);
    step.setTracks([track], new Set([0]));

    step.advance();
    expect(step.currentIndex).toBe(1);

    step.reset();
    expect(step.currentIndex).toBe(0);
    expect(step.getCurrentNotes()?.notes[0].midi).toBe(60);
  });

  it("should go back to previous step", () => {
    const track = makeTrack([
      makeNote(60, 0.0),
      makeNote(64, 0.5),
      makeNote(67, 1.0),
    ]);
    step.setTracks([track], new Set([0]));

    step.advance(); // at index 1
    step.advance(); // at index 2

    const prev = step.goBack();
    expect(prev?.notes[0].midi).toBe(64);
    expect(step.currentIndex).toBe(1);

    // Can't go before beginning
    step.goBack(); // index 0
    const beforeStart = step.goBack();
    expect(beforeStart).toBeNull();
    expect(step.currentIndex).toBe(0);
  });

  it("should only include notes from active tracks", () => {
    const track0 = makeTrack([makeNote(60, 0.0), makeNote(64, 0.5)]);
    const track1 = makeTrack([makeNote(48, 0.0), makeNote(52, 0.5)]);

    // Only track 1 active
    step.setTracks([track0, track1], new Set([1]));

    expect(step.totalSteps).toBe(2);
    expect(step.getCurrentNotes()?.notes[0].midi).toBe(48);
  });

  it("should merge notes from multiple active tracks into chords", () => {
    const track0 = makeTrack([makeNote(60, 0.0)]);
    const track1 = makeTrack([makeNote(48, 0.02)]); // within chord window

    step.setTracks([track0, track1], new Set([0, 1]));

    expect(step.totalSteps).toBe(1);
    expect(step.getCurrentNotes()?.notes).toHaveLength(2);
  });

  it("should handle empty active tracks gracefully", () => {
    const track = makeTrack([makeNote(60, 0.0)]);
    step.setTracks([track], new Set()); // no active tracks

    expect(step.totalSteps).toBe(0);
    expect(step.advance()).toBeNull();
  });
});
