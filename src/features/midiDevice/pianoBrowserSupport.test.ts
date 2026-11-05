import { describe, expect, test } from "vitest";
import { detectPianoBrowserSupport } from "./pianoBrowserSupport";

const ua = {
  chromeWin:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
  firefox:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
};

describe("detectPianoBrowserSupport", () => {
  test("any browser with Web Bluetooth is fine, Bluefy on iPad included", () => {
    expect(
      detectPianoBrowserSupport({ userAgent: ua.chromeWin, bluetooth: {} }),
    ).toBe("ok");
    expect(
      detectPianoBrowserSupport({ userAgent: ua.iphone, bluetooth: {} }),
    ).toBe("ok");
  });

  test("iPad pretending to be a Mac is still sent to Bluefy", () => {
    expect(
      detectPianoBrowserSupport({
        userAgent: ua.safariMac,
        platform: "MacIntel",
        maxTouchPoints: 5,
      }),
    ).toBe("ios");
    expect(detectPianoBrowserSupport({ userAgent: ua.iphone })).toBe("ios");
  });

  test("Safari on a Mac and Firefox are asked to use Chrome or Edge", () => {
    expect(
      detectPianoBrowserSupport({
        userAgent: ua.safariMac,
        platform: "MacIntel",
        maxTouchPoints: 0,
      }),
    ).toBe("mac-safari");
    expect(detectPianoBrowserSupport({ userAgent: ua.firefox })).toBe("other");
  });
});
