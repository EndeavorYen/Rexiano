import { describe, expect, test } from "vitest";
import {
  getPracticeToolbarControlVisibility,
  getPracticeToolbarInitialExpanded,
} from "./PracticeToolbar";

describe("getPracticeToolbarControlVisibility", () => {
  test("shows the advanced disclosure outside child focus mode", () => {
    expect(
      getPracticeToolbarControlVisibility({ childFocusMode: false }),
    ).toEqual({
      showModeSelector: true,
      showSpeedControl: true,
      showAdvancedDisclosure: true,
      showAdvancedControls: true,
    });
  });

  test("hides advanced practice controls in child focus mode", () => {
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
  test("opens advanced controls when the current song setup needs fixing", () => {
    expect(
      getPracticeToolbarInitialExpanded({
        childFocusMode: false,
        needsSongSetupFix: true,
      }),
    ).toBe(true);
  });

  test("keeps advanced controls closed in child focus mode", () => {
    expect(
      getPracticeToolbarInitialExpanded({
        childFocusMode: true,
        needsSongSetupFix: true,
      }),
    ).toBe(false);
  });
});
