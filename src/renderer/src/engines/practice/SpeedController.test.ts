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

  it("clamps below minimum (0.10)", () => {
    ctrl.setSpeed(0.05);
    // Target is set; tick to reach it immediately
    ctrl.tick(1000);
    ctrl.tick(1300);
    expect(ctrl.multiplier).toBe(0.10);
  });

  it("clamps above maximum (2.0)", () => {
    ctrl.setSpeed(5.0);
    ctrl.tick(1000);
    ctrl.tick(1300);
    expect(ctrl.multiplier).toBe(2.0);
  });

  it("computes effective pixelsPerSecond", () => {
    ctrl.setSpeed(0.5);
    ctrl.tick(0);
    ctrl.tick(300); // complete the lerp
    expect(ctrl.effectivePixelsPerSecond(200)).toBe(100);

    ctrl.setSpeed(2.0);
    ctrl.tick(400);
    ctrl.tick(700);
    expect(ctrl.effectivePixelsPerSecond(200)).toBe(400);
  });

  it("reset() returns to 1.0x immediately", () => {
    ctrl.setSpeed(0.75);
    ctrl.tick(0);
    ctrl.tick(300);
    ctrl.reset();
    expect(ctrl.multiplier).toBe(1.0);
    expect(ctrl.targetSpeed).toBe(1.0);
  });

  it("handles boundary values", () => {
    ctrl.setSpeed(0.10);
    ctrl.tick(0);
    ctrl.tick(300);
    expect(ctrl.multiplier).toBe(0.10);

    ctrl.setSpeed(2.0);
    ctrl.tick(400);
    ctrl.tick(700);
    expect(ctrl.multiplier).toBe(2.0);
  });

  // ── bumpSpeed ──

  describe("bumpSpeed", () => {
    it("adds positive delta and returns new speed", () => {
      ctrl.setSpeed(0.5);
      ctrl.tick(0);
      ctrl.tick(300);
      const result = ctrl.bumpSpeed(0.05);
      expect(result).toBe(0.55);
      expect(ctrl.targetSpeed).toBe(0.55);
    });

    it("adds negative delta", () => {
      ctrl.setSpeed(1.0);
      ctrl.tick(0);
      ctrl.tick(300);
      const result = ctrl.bumpSpeed(-0.25);
      expect(result).toBe(0.75);
    });

    it("clamps at MIN when bumping down", () => {
      ctrl.setSpeed(0.15);
      ctrl.tick(0);
      ctrl.tick(300);
      const result = ctrl.bumpSpeed(-0.10);
      expect(result).toBe(0.10);
    });

    it("clamps at MAX when bumping up", () => {
      ctrl.setSpeed(1.95);
      ctrl.tick(0);
      ctrl.tick(300);
      const result = ctrl.bumpSpeed(0.10);
      expect(result).toBe(2.0);
    });
  });

  // ── Smooth lerp / tick ──

  describe("smooth interpolation (tick)", () => {
    it("returns current speed when no change pending", () => {
      const result = ctrl.tick(1000);
      expect(result).toBe(1.0);
    });

    it("lerps toward target over 200ms", () => {
      ctrl.setSpeed(0.5);

      // First tick initializes the lerp start time
      const t0 = 1000;
      ctrl.tick(t0);

      // At 100ms (halfway), should be partway between 1.0 and 0.5
      const mid = ctrl.tick(t0 + 100);
      expect(mid).toBeGreaterThan(0.5);
      expect(mid).toBeLessThan(1.0);

      // At 200ms, should have reached the target
      const end = ctrl.tick(t0 + 200);
      expect(end).toBe(0.5);
    });

    it("completes lerp after duration expires", () => {
      ctrl.setSpeed(1.5);
      ctrl.tick(0);
      ctrl.tick(500); // well past 200ms
      expect(ctrl.multiplier).toBe(1.5);
    });

    it("targetSpeed reflects the set value", () => {
      ctrl.setSpeed(0.75);
      expect(ctrl.targetSpeed).toBe(0.75);
      // multiplier hasn't caught up yet
      expect(ctrl.multiplier).toBe(1.0);
    });
  });
});
