/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import {
  clearHighlights,
  highlightStep,
  type CursorStep,
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

describe("highlightStep", () => {
  it("adds osmd-note-active to step SVG elements", () => {
    const container = document.createElement("div");
    const el1 = document.createElement("path");
    const el2 = document.createElement("path");
    container.appendChild(el1);
    container.appendChild(el2);

    const step: CursorStep = {
      svgElements: [el1, el2],
    };

    highlightStep(step, container);

    expect(el1.classList.contains("osmd-note-active")).toBe(true);
    expect(el2.classList.contains("osmd-note-active")).toBe(true);
  });

  it("clears previous highlights before applying new", () => {
    const container = document.createElement("div");
    const old = document.createElement("path");
    old.classList.add("osmd-note-active");
    container.appendChild(old);

    const newEl = document.createElement("path");
    container.appendChild(newEl);

    const step: CursorStep = {
      svgElements: [newEl],
    };

    highlightStep(step, container);

    expect(old.classList.contains("osmd-note-active")).toBe(false);
    expect(newEl.classList.contains("osmd-note-active")).toBe(true);
  });
});
