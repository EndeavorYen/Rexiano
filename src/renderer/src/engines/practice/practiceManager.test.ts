// practiceManager.test.ts
import { describe, it, expect, beforeEach } from "vitest";
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
});
