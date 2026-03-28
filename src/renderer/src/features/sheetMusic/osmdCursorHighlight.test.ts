/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { findActiveEntry, clearHighlights, type CursorTimeEntry } from "./osmdCursorHighlight";

describe("findActiveEntry", () => {
  const timeMap: CursorTimeEntry[] = [
    { time: 0, endTime: 0.5, stepIndex: 0, measureIndex: 0 },
    { time: 0.5, endTime: 1.0, stepIndex: 1, measureIndex: 0 },
    { time: 1.0, endTime: 1.5, stepIndex: 2, measureIndex: 0 },
    { time: 1.5, endTime: 2.0, stepIndex: 3, measureIndex: 0 },
    { time: 2.0, endTime: 4.0, stepIndex: 4, measureIndex: 1 }, // long note (2s)
  ];

  it("returns first entry at time 0", () => {
    const entry = findActiveEntry(timeMap, 0);
    expect(entry?.stepIndex).toBe(0);
  });

  it("returns correct entry mid-duration", () => {
    const entry = findActiveEntry(timeMap, 0.3);
    expect(entry?.stepIndex).toBe(0);
  });

  it("returns next entry at boundary", () => {
    const entry = findActiveEntry(timeMap, 0.5);
    expect(entry?.stepIndex).toBe(1);
  });

  it("returns long note entry throughout its duration", () => {
    expect(findActiveEntry(timeMap, 2.0)?.stepIndex).toBe(4);
    expect(findActiveEntry(timeMap, 3.0)?.stepIndex).toBe(4);
    expect(findActiveEntry(timeMap, 3.9)?.stepIndex).toBe(4);
  });

  it("returns null after all notes end", () => {
    expect(findActiveEntry(timeMap, 4.0)).toBeNull();
    expect(findActiveEntry(timeMap, 10.0)).toBeNull();
  });

  it("returns null for negative time", () => {
    expect(findActiveEntry(timeMap, -1)).toBeNull();
  });

  it("returns null for empty time map", () => {
    expect(findActiveEntry([], 1.0)).toBeNull();
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

  it("does nothing when no highlights exist", () => {
    const container = document.createElement("div");
    container.appendChild(document.createElement("span"));
    expect(() => clearHighlights(container)).not.toThrow();
  });
});
