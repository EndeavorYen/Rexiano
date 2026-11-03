import { describe, expect, test } from "vitest";
import { getThemePickerNavigationTarget } from "./themePickerKeyboard";

describe("ThemePicker keyboard navigation", () => {
  test("wraps horizontal and vertical arrow navigation", () => {
    expect(getThemePickerNavigationTarget("lavender", "ArrowLeft")).toBe(
      "midnight",
    );
    expect(getThemePickerNavigationTarget("midnight", "ArrowRight")).toBe(
      "lavender",
    );
    expect(getThemePickerNavigationTarget("ocean", "ArrowDown")).toBe("peach");
    expect(getThemePickerNavigationTarget("ocean", "ArrowUp")).toBe("lavender");
  });

  test("supports Home and End without swallowing unrelated keys", () => {
    expect(getThemePickerNavigationTarget("peach", "Home")).toBe("lavender");
    expect(getThemePickerNavigationTarget("ocean", "End")).toBe("midnight");
    expect(getThemePickerNavigationTarget("ocean", "Tab")).toBeNull();
  });
});
