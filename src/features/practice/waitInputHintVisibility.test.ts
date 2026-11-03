import { describe, expect, test } from "vitest";
import { shouldShowWaitInputHint } from "./waitInputHintVisibility";

describe("shouldShowWaitInputHint", () => {
  test("shows in Wait mode when no wired or Bluetooth keyboard is connected", () => {
    expect(
      shouldShowWaitInputHint({
        mode: "wait",
        isConnected: false,
        bleStatus: "idle",
      }),
    ).toBe(true);
  });

  test("hides once a wired keyboard connects", () => {
    expect(
      shouldShowWaitInputHint({
        mode: "wait",
        isConnected: true,
        bleStatus: "idle",
      }),
    ).toBe(false);
  });

  test("hides once a Bluetooth keyboard connects", () => {
    expect(
      shouldShowWaitInputHint({
        mode: "wait",
        isConnected: false,
        bleStatus: "connected",
      }),
    ).toBe(false);
  });

  test("never shows in Watch mode", () => {
    expect(
      shouldShowWaitInputHint({
        mode: "watch",
        isConnected: false,
        bleStatus: "idle",
      }),
    ).toBe(false);
  });
});
