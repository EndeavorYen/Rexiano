import { describe, expect, test, vi, type Mock } from "vitest";
import { createOnScreenKeyInput } from "./onScreenKeyInput";

interface Harness {
  active: Set<number>;
  noteOn: Mock<(midi: number) => void>;
  noteOff: Mock<(midi: number) => void>;
  setTargets: (targets: number[] | null) => void;
  setEnabled: (enabled: boolean) => void;
  input: ReturnType<typeof createOnScreenKeyInput>;
}

/** Fake store + Wait engine: resumes (clears targets) once all are held. */
function harness(initialTargets: number[] | null): Harness {
  const active = new Set<number>();
  let targets: Set<number> | null = initialTargets
    ? new Set(initialTargets)
    : null;
  const noteOn = vi.fn((midi: number) => {
    active.add(midi);
    if (targets && [...targets].every((m) => active.has(m))) targets = null;
  });
  const noteOff = vi.fn((midi: number) => {
    active.delete(midi);
  });
  let enabled = true;
  const input = createOnScreenKeyInput({
    noteOn,
    noteOff,
    waitTargets: () => targets,
    enabled: () => enabled,
  });
  return {
    active,
    noteOn,
    noteOff,
    setTargets: (next) => {
      targets = next ? new Set(next) : null;
    },
    setEnabled: (next) => {
      enabled = next;
    },
    input,
  };
}

describe("createOnScreenKeyInput", () => {
  test("a single note passes straight through", () => {
    const h = harness([60]);
    h.input.noteOn(60);
    h.input.noteOff(60);
    expect(h.noteOff).toHaveBeenCalledWith(60);
    expect(h.active.size).toBe(0);
  });

  test("a mouse can play a chord one key at a time", () => {
    const h = harness([60, 64]);
    h.input.noteOn(60);
    h.input.noteOff(60);
    // C stays down for the chord instead of being released.
    expect(h.active.has(60)).toBe(true);
    h.input.noteOn(64);
    // Chord complete: Wait resumed and the latched C was released.
    expect(h.active.has(60)).toBe(false);
    h.input.noteOff(64);
    expect(h.active.size).toBe(0);
  });

  test("a wrong note during a chord is released normally", () => {
    const h = harness([60, 64]);
    h.input.noteOn(62);
    h.input.noteOff(62);
    expect(h.noteOff).toHaveBeenCalledWith(62);
    expect(h.active.has(62)).toBe(false);
  });

  test("leaving Wait releases latched notes", () => {
    const h = harness([60, 64]);
    h.input.noteOn(60);
    h.input.noteOff(60);
    h.setTargets(null);
    h.input.releaseStale();
    expect(h.active.has(60)).toBe(false);
  });

  test("outside Wait every note is released on lift", () => {
    const h = harness(null);
    h.input.noteOn(60);
    h.input.noteOff(60);
    expect(h.active.size).toBe(0);
  });

  test("does nothing while a real keyboard is connected", () => {
    const h = harness([60]);
    h.setEnabled(false);
    h.input.noteOn(60);
    h.input.noteOff(60);
    expect(h.noteOn).not.toHaveBeenCalled();
    expect(h.noteOff).not.toHaveBeenCalled();
  });

  test("connecting a keyboard releases on-screen latches", () => {
    const h = harness([60, 64]);
    h.input.noteOn(60);
    h.input.noteOff(60);
    expect(h.active.has(60)).toBe(true);
    h.setEnabled(false);
    h.input.releaseStale();
    expect(h.active.has(60)).toBe(false);
  });

  test("never releases a note this input did not turn on", () => {
    const h = harness(null);
    h.input.noteOff(72);
    expect(h.noteOff).not.toHaveBeenCalled();
  });

  test("a stale latch from the last chord is gone once the next one starts", () => {
    const h = harness([60, 64]);
    h.input.noteOn(60);
    h.input.noteOff(60);
    // Wait moved on to a different chord without the on-screen keys.
    h.setTargets([62, 65]);
    h.input.releaseStale();
    expect(h.active.has(60)).toBe(false);
  });
});
