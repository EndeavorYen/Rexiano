import { describe, test, expect } from "vitest";
import { formatSpeed } from "./SpeedSlider";

describe("SpeedSlider helpers", () => {
  describe("formatSpeed", () => {
    test("formats multiplier speeds as percentages", () => {
      expect(formatSpeed(0.25)).toBe("25%");
      expect(formatSpeed(0.5)).toBe("50%");
      expect(formatSpeed(0.75)).toBe("75%");
      expect(formatSpeed(1)).toBe("100%");
      expect(formatSpeed(1.5)).toBe("150%");
      expect(formatSpeed(2)).toBe("200%");
    });
  });
});
