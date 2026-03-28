/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import {
  clearHighlights,
  advanceAndHighlight,
  resetCursor,
} from "./osmdCursorHighlight";

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

describe("advanceAndHighlight", () => {
  it("calls cursor.next() and does not throw when no gNotes", () => {
    const mockCursor = {
      next: vi.fn(),
      Iterator: { EndReached: false },
      GNotesUnderCursor: vi.fn(() => []),
    };
    const osmd = { cursor: mockCursor };
    const container = document.createElement("div");

    advanceAndHighlight(osmd, container);

    expect(mockCursor.next).toHaveBeenCalledOnce();
    expect(mockCursor.GNotesUnderCursor).toHaveBeenCalledOnce();
  });

  it("does nothing when cursor is null", () => {
    const container = document.createElement("div");
    expect(() => advanceAndHighlight({}, container)).not.toThrow();
    expect(() => advanceAndHighlight(null, container)).not.toThrow();
  });

  it("does not highlight when iterator reached end", () => {
    const mockCursor = {
      next: vi.fn(),
      Iterator: { EndReached: true },
      GNotesUnderCursor: vi.fn(() => []),
    };
    const osmd = { cursor: mockCursor };
    const container = document.createElement("div");

    advanceAndHighlight(osmd, container);

    expect(mockCursor.next).toHaveBeenCalledOnce();
    expect(mockCursor.GNotesUnderCursor).not.toHaveBeenCalled();
  });
});

describe("resetCursor", () => {
  it("calls cursor.reset() and clears highlights", () => {
    const mockCursor = { reset: vi.fn() };
    const osmd = { cursor: mockCursor };
    const container = document.createElement("div");
    const el = document.createElement("span");
    el.classList.add("osmd-note-active");
    container.appendChild(el);

    resetCursor(osmd, container);

    expect(mockCursor.reset).toHaveBeenCalledOnce();
    expect(el.classList.contains("osmd-note-active")).toBe(false);
  });
});
