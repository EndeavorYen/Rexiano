import { describe, it, expect, beforeEach } from "vitest";
import { SpeedController } from "./SpeedController";

describe("SpeedController", () => {
  let ctrl: SpeedController;

  beforeEach(() => {
    ctrl = new SpeedController();
  });

  it("defaults to 1.0x", () => {
    expect(ctrl.multiplier).toBe(1.0);
  });

  it("accepts custom initial speed", () => {
    const c = new SpeedController(0.5);
    expect(c.multiplier).toBe(0.5);
  });

  it("clamps below minimum (0.25)", () => {
    ctrl.setSpeed(0.1);
    expect(ctrl.multiplier).toBe(0.25);
  });

  it("clamps above maximum (2.0)", () => {
    ctrl.setSpeed(5.0);
    expect(ctrl.multiplier).toBe(2.0);
  });

  it("computes effective pixelsPerSecond", () => {
    ctrl.setSpeed(0.5);
    expect(ctrl.effectivePixelsPerSecond(200)).toBe(100);

    ctrl.setSpeed(2.0);
    expect(ctrl.effectivePixelsPerSecond(200)).toBe(400);
  });

  it("reset() returns to 1.0x", () => {
    ctrl.setSpeed(0.75);
    ctrl.reset();
    expect(ctrl.multiplier).toBe(1.0);
  });

  it("handles boundary values", () => {
    ctrl.setSpeed(0.25);
    expect(ctrl.multiplier).toBe(0.25);

    ctrl.setSpeed(2.0);
    expect(ctrl.multiplier).toBe(2.0);
  });
});
