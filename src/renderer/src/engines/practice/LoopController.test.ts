import { describe, it, expect, beforeEach } from "vitest";
import { LoopController } from "./LoopController";

describe("LoopController", () => {
  let loop: LoopController;

  beforeEach(() => {
    loop = new LoopController();
  });

  it("starts inactive", () => {
    expect(loop.isActive).toBe(false);
    expect(loop.startTime).toBeNull();
    expect(loop.endTime).toBeNull();
  });

  it("shouldLoop returns false when inactive", () => {
    expect(loop.shouldLoop(10)).toBe(false);
  });

  it("sets a valid range", () => {
    expect(loop.setRange(5, 15)).toBe(true);
    expect(loop.isActive).toBe(true);
    expect(loop.startTime).toBe(5);
    expect(loop.endTime).toBe(15);
  });

  it("rejects invalid range (start >= end)", () => {
    expect(loop.setRange(10, 5)).toBe(false);
    expect(loop.isActive).toBe(false);
  });

  it("rejects equal start and end", () => {
    expect(loop.setRange(5, 5)).toBe(false);
    expect(loop.isActive).toBe(false);
  });

  it("rejects negative start", () => {
    expect(loop.setRange(-1, 5)).toBe(false);
  });

  it("shouldLoop returns true when currentTime >= endTime", () => {
    loop.setRange(5, 15);
    expect(loop.shouldLoop(14.9)).toBe(false);
    expect(loop.shouldLoop(15)).toBe(true);
    expect(loop.shouldLoop(20)).toBe(true);
  });

  it("getLoopStart returns start time", () => {
    loop.setRange(5, 15);
    expect(loop.getLoopStart()).toBe(5);
  });

  it("getLoopStart returns 0 when no loop set", () => {
    expect(loop.getLoopStart()).toBe(0);
  });

  it("clear() deactivates the loop", () => {
    loop.setRange(5, 15);
    loop.clear();
    expect(loop.isActive).toBe(false);
    expect(loop.shouldLoop(20)).toBe(false);
  });
});
