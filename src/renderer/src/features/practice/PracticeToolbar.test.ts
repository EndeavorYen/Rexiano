import { describe, expect, test } from "vitest";
import {
  getPracticeToolbarControlVisibility,
  getPracticeToolbarInitialExpanded,
} from "./PracticeToolbar";

describe("getPracticeToolbarControlVisibility", () => {
  test("keeps Watch/Wait and speed, and hides advanced practice chrome", () => {
    expect(
      getPracticeToolbarControlVisibility({ childFocusMode: false }),
    ).toEqual({
      showModeSelector: true,
      showSpeedControl: true,
      showAdvancedDisclosure: false,
      showAdvancedControls: false,
    });
    expect(
      getPracticeToolbarControlVisibility({ childFocusMode: true }),
    ).toEqual({
      showModeSelector: true,
      showSpeedControl: true,
      showAdvancedDisclosure: false,
      showAdvancedControls: false,
    });
  });
});

describe("getPracticeToolbarInitialExpanded", () => {
  test("does not open advanced controls when the current song setup needs fixing", () => {
    expect(
      getPracticeToolbarInitialExpanded({
        childFocusMode: false,
        needsSongSetupFix: true,
      }),
    ).toBe(false);
  });

  test("keeps advanced controls closed in child focus mode", () => {
    expect(
      getPracticeToolbarInitialExpanded({
        childFocusMode: true,
        needsSongSetupFix: true,
      }),
    ).toBe(false);
  });

  test("keeps advanced closed when the song setup does not need a fix", () => {
    expect(
      getPracticeToolbarInitialExpanded({
        childFocusMode: false,
        needsSongSetupFix: false,
      }),
    ).toBe(false);
  });
});
