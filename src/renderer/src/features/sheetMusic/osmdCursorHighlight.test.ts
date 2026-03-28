/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import {
  clearHighlights,
  highlightStep,
  findStepAtTime,
  type CursorStep,
} from "./osmdCursorHighlight";

describe("findStepAtTime", () => {
  const steps: CursorStep[] = [
    { time: 0, endTime: 0.5, svgElements: [] },
    { time: 0.5, endTime: 1.0, svgElements: [] },
    { time: 1.0, endTime: 1.5, svgElements: [] },
    { time: 2.0, endTime: 4.0, svgElements: [] }, // long note
  ];

  it("returns first step at time 0", () => {
    expect(findStepAtTime(steps, 0)).toBe(steps[0]);
  });

  it("returns correct step mid-duration", () => {
    expect(findStepAtTime(steps, 0.3)).toBe(steps[0]);
  });

  it("returns next step at boundary", () => {
    expect(findStepAtTime(steps, 0.5)).toBe(steps[1]);
  });

  it("returns long note throughout its duration", () => {
    expect(findStepAtTime(steps, 2.5)).toBe(steps[3]);
    expect(findStepAtTime(steps, 3.9)).toBe(steps[3]);
  });

  it("returns null after all notes end", () => {
    expect(findStepAtTime(steps, 4.0)).toBeNull();
  });

  it("returns null for negative time", () => {
    expect(findStepAtTime(steps, -1)).toBeNull();
  });

  it("returns null for empty steps", () => {
    expect(findStepAtTime([], 1.0)).toBeNull();
  });

  it("returns null in gap between steps", () => {
    // Gap between step[2] (endTime 1.5) and step[3] (time 2.0)
    expect(findStepAtTime(steps, 1.7)).toBeNull();
  });
});

describe("clearHighlights", () => {
  it("removes osmd-note-active class from all children", () => {
    const container = document.createElement("div");
    const el1 = document.createElement("span");
    const el2 = document.createElement("span");
    el1.classList.add("osmd-note-active");
    el2.classList.add("osmd-note-active");
    container.appendChild(el1);
    container.appendChild(el2);

    clearHighlights(container);

    expect(el1.classList.contains("osmd-note-active")).toBe(false);
    expect(el2.classList.contains("osmd-note-active")).toBe(false);
  });
});

describe("highlightStep", () => {
  it("adds osmd-note-active to step SVG elements", () => {
    const el1 = document.createElement("path");
    const el2 = document.createElement("path");

    highlightStep({ time: 0, endTime: 1, svgElements: [el1, el2] }, null);

    expect(el1.classList.contains("osmd-note-active")).toBe(true);
    expect(el2.classList.contains("osmd-note-active")).toBe(true);
  });

  it("clears previous step elements directly", () => {
    const oldEl = document.createElement("path");
    oldEl.classList.add("osmd-note-active");

    const newEl = document.createElement("path");

    const prevStep: CursorStep = { time: 0, endTime: 0.5, svgElements: [oldEl] };
    highlightStep({ time: 0.5, endTime: 1, svgElements: [newEl] }, prevStep);

    expect(oldEl.classList.contains("osmd-note-active")).toBe(false);
    expect(newEl.classList.contains("osmd-note-active")).toBe(true);
  });
});
