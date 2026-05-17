import { describe, expect, test } from "vitest";
import { getPracticeToolbarControlVisibility } from "./PracticeToolbar";

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
