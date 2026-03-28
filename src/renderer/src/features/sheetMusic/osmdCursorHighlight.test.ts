/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import {
  clearHighlights,
  highlightNotesUnderCursor,
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

describe("highlightNotesUnderCursor", () => {
  it("does not throw when osmd is null", () => {
    expect(() => highlightNotesUnderCursor(null)).not.toThrow();
  });

  it("does not throw when cursor has no notes", () => {
    const osmd = { cursor: { GNotesUnderCursor: vi.fn(() => []) } };
    expect(() => highlightNotesUnderCursor(osmd)).not.toThrow();
  });
});
