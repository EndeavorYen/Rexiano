/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { estimateBeatPosition, clearHighlights } from "./osmdNoteHighlight";

describe("estimateBeatPosition", () => {
  it("returns measure 0 beat 0 at time=0", () => {
    const result = estimateBeatPosition(0, 120, 4, 4);
    expect(result).toEqual({ measureIndex: 0, beat: 0 });
  });

  it("returns measure 1 beat 0 at time=2s with 120bpm 4/4", () => {
    // 120bpm → 0.5s per beat → 4 beats per measure → 2s per measure
    const result = estimateBeatPosition(2, 120, 4, 4);
    expect(result.measureIndex).toBe(1);
    expect(result.beat).toBeCloseTo(0, 10);
  });

  it("handles fractional beat positions", () => {
    // 120bpm → 0.5s per beat. At time=1.25s → 2.5 beats → measure 0, beat 2.5
    const result = estimateBeatPosition(1.25, 120, 4, 4);
    expect(result.measureIndex).toBe(0);
    expect(result.beat).toBeCloseTo(2.5, 10);
  });

  it("handles 3/4 time signature", () => {
    // 120bpm → 0.5s per beat, 3 beats per measure → 1.5s per measure
    // At time=1.5s → measure 1 beat 0
    const result = estimateBeatPosition(1.5, 120, 3, 4);
    expect(result.measureIndex).toBe(1);
    expect(result.beat).toBeCloseTo(0, 10);
  });

  it("clamps negative time to 0", () => {
    const result = estimateBeatPosition(-5, 120, 4, 4);
    expect(result).toEqual({ measureIndex: 0, beat: 0 });
  });

  it("returns origin when secPerMeasure is 0 (degenerate input)", () => {
    // denominator=0 would cause beatsPerMeasure to be Infinity, secPerMeasure Infinity
    // numerator=0 → beatsPerMeasure=0 → secPerMeasure=0
    const result = estimateBeatPosition(5, 120, 0, 4);
    expect(result).toEqual({ measureIndex: 0, beat: 0 });
  });
});

describe("clearHighlights", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("removes osmd-note-active class from children", () => {
    const child1 = document.createElement("span");
    const child2 = document.createElement("span");
    child1.classList.add("osmd-note-active");
    child2.classList.add("osmd-note-active", "other-class");
    container.appendChild(child1);
    container.appendChild(child2);

    clearHighlights(container);

    expect(child1.classList.contains("osmd-note-active")).toBe(false);
    expect(child2.classList.contains("osmd-note-active")).toBe(false);
    expect(child2.classList.contains("other-class")).toBe(true);
  });

  it("does nothing when no active highlights exist", () => {
    const child = document.createElement("span");
    child.classList.add("some-class");
    container.appendChild(child);

    clearHighlights(container);

    expect(child.classList.contains("some-class")).toBe(true);
  });
});
