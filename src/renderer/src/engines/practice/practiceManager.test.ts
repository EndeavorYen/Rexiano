// practiceManager.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initPracticeEngines,
  getPracticeEngines,
  disposePracticeEngines,
} from "./practiceManager";

describe("practiceManager", () => {
  beforeEach(() => {
    disposePracticeEngines();
  });

  it("returns null engines before init", () => {
    const e = getPracticeEngines();
    expect(e.waitMode).toBeNull();
    expect(e.speedController).toBeNull();
    expect(e.loopController).toBeNull();
    expect(e.scoreCalculator).toBeNull();
  });

  it("initializes all four engines", () => {
    initPracticeEngines();
    const e = getPracticeEngines();
    expect(e.waitMode).not.toBeNull();
    expect(e.speedController).not.toBeNull();
    expect(e.loopController).not.toBeNull();
    expect(e.scoreCalculator).not.toBeNull();
  });

  it("dispose nulls everything", () => {
    initPracticeEngines();
    disposePracticeEngines();
    const e = getPracticeEngines();
    expect(e.waitMode).toBeNull();
  });

  it("idempotent init does not create duplicates", () => {
    initPracticeEngines();
    const first = getPracticeEngines().waitMode;
    initPracticeEngines();
    expect(getPracticeEngines().waitMode).toBe(first);
  });

  it("getPracticeEngines returns the same object reference every call", () => {
    initPracticeEngines();
    const ref1 = getPracticeEngines();
    const ref2 = getPracticeEngines();
    expect(ref1).toBe(ref2); // same reference, not just deep-equal
  });

  it("stable reference persists after dispose (fields null, same object)", () => {
    initPracticeEngines();
    const ref1 = getPracticeEngines();
    disposePracticeEngines();
    const ref2 = getPracticeEngines();
    expect(ref2).toBe(ref1); // same mutable object
    expect(ref2.waitMode).toBeNull();
  });

  it("dispose calls clearCallbacks on waitMode", () => {
    initPracticeEngines();
    const wm = getPracticeEngines().waitMode!;
    const spy = vi.spyOn(wm, "clearCallbacks");
    disposePracticeEngines();
    expect(spy).toHaveBeenCalledOnce();
  });
});
