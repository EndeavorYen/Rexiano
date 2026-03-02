import { describe, test, expect } from "vitest";
import { fmtSec } from "./ABLoopSelector";

describe("ABLoopSelector helpers", () => {
  describe("fmtSec", () => {
    test("formats 0 seconds as 0:00", () => {
      expect(fmtSec(0)).toBe("0:00");
    });

    test("formats seconds under a minute", () => {
      expect(fmtSec(5)).toBe("0:05");
      expect(fmtSec(30)).toBe("0:30");
      expect(fmtSec(59)).toBe("0:59");
    });

    test("formats whole minutes", () => {
      expect(fmtSec(60)).toBe("1:00");
      expect(fmtSec(120)).toBe("2:00");
    });

    test("formats minutes and seconds", () => {
      expect(fmtSec(90)).toBe("1:30");
      expect(fmtSec(185)).toBe("3:05");
    });

    test("floors fractional seconds", () => {
      expect(fmtSec(0.9)).toBe("0:00");
      expect(fmtSec(1.5)).toBe("0:01");
      expect(fmtSec(61.7)).toBe("1:01");
    });

    test("pads single-digit seconds with leading zero", () => {
      expect(fmtSec(3)).toBe("0:03");
      expect(fmtSec(63)).toBe("1:03");
    });
  });
});
