import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the theme store before importing the module under test
vi.mock("@renderer/stores/useThemeStore", () => ({
  useThemeStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@renderer/themes/tokens", () => ({
  hexToPixi: vi.fn((hex: string) => parseInt(hex.replace("#", ""), 16)),
}));

import { getTrackColor, getCanvasBgColor, getHitLineColor } from "./noteColors";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import { hexToPixi } from "@renderer/themes/tokens";

const mockedGetState = vi.mocked(useThemeStore.getState);
const mockedHexToPixi = vi.mocked(hexToPixi);

/** Helper to build a mock theme store state */
function mockThemeState(
  themeId: string,
  overrides: Partial<{
    note1: string;
    note2: string;
    note3: string;
    note4: string;
    note5: string;
    note6: string;
    note7: string;
    note8: string;
    canvasBg: string;
    hitLine: string;
  }> = {},
) {
  return {
    themeId,
    theme: {
      colors: {
        note1: overrides.note1 ?? "#AA0000",
        note2: overrides.note2 ?? "#00BB00",
        note3: overrides.note3 ?? "#0000CC",
        note4: overrides.note4 ?? "#DD00DD",
        note5: overrides.note5 ?? "#00EEAA",
        note6: overrides.note6 ?? "#EE8800",
        note7: overrides.note7 ?? "#EE66AA",
        note8: overrides.note8 ?? "#88CC00",
        canvasBg: overrides.canvasBg ?? "#FFFFFF",
        hitLine: overrides.hitLine ?? "#FF0000",
      },
    },
  };
}

describe("noteColors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level cache by re-importing would be ideal, but
    // we can force cache invalidation by changing the themeId each test.
  });

  describe("getTrackColor", () => {
    it("returns the correct PixiJS tint for track 0", () => {
      mockedGetState.mockReturnValue(mockThemeState("test-theme-a") as ReturnType<typeof useThemeStore.getState>);

      const color = getTrackColor(0);

      expect(mockedHexToPixi).toHaveBeenCalledWith("#AA0000");
      expect(color).toBe(0xaa0000);
    });

    it("returns different colors for tracks 0-3", () => {
      mockedGetState.mockReturnValue(mockThemeState("test-theme-b") as ReturnType<typeof useThemeStore.getState>);

      const colors = [0, 1, 2, 3].map((i) => getTrackColor(i));

      expect(colors[0]).toBe(0xaa0000); // note1
      expect(colors[1]).toBe(0x00bb00); // note2
      expect(colors[2]).toBe(0x0000cc); // note3
      expect(colors[3]).toBe(0xdd00dd); // note4
    });

    it("cycles track colors for index >= 8 (trackIndex % 8)", () => {
      mockedGetState.mockReturnValue(
        mockThemeState("test-theme-c") as ReturnType<
          typeof useThemeStore.getState
        >,
      );

      // Track 8 should wrap to note1 (index 0)
      expect(getTrackColor(8)).toBe(getTrackColor(0));
      // Track 9 wraps to note2 (index 1)
      expect(getTrackColor(9)).toBe(getTrackColor(1));
      // Track 15 wraps to note8 (index 7)
      expect(getTrackColor(15)).toBe(getTrackColor(7));
    });

    it("caches palette per theme — does not recompute on same themeId", () => {
      mockedGetState.mockReturnValue(mockThemeState("cached-theme") as ReturnType<typeof useThemeStore.getState>);

      getTrackColor(0);
      // hexToPixi should be called 8 times for the 8-color palette build
      const callCountAfterFirst = mockedHexToPixi.mock.calls.length;

      getTrackColor(1);
      getTrackColor(2);
      // No additional hexToPixi calls since the theme hasn't changed
      expect(mockedHexToPixi).toHaveBeenCalledTimes(callCountAfterFirst);
    });

    it("rebuilds cache when theme changes", () => {
      mockedGetState.mockReturnValue(
        mockThemeState("theme-1") as ReturnType<typeof useThemeStore.getState>,
      );
      const color1 = getTrackColor(0);

      // Switch to a different theme with different note1 color
      mockedGetState.mockReturnValue(
        mockThemeState("theme-2", {
          note1: "#111111",
        }) as ReturnType<typeof useThemeStore.getState>,
      );

      const color2 = getTrackColor(0);
      // Color should have changed to reflect the new theme
      expect(color2).toBe(0x111111);
      expect(color2).not.toBe(color1);
      expect(mockedHexToPixi).toHaveBeenCalledWith("#111111");
    });

    it("handles large track indices without error", () => {
      mockedGetState.mockReturnValue(mockThemeState("large-idx") as ReturnType<typeof useThemeStore.getState>);

      // Should not throw for arbitrarily large indices
      expect(() => getTrackColor(100)).not.toThrow();
      expect(getTrackColor(100)).toBe(getTrackColor(100 % 8));
    });
  });

  describe("getCanvasBgColor", () => {
    it("returns the canvas background color as a PixiJS number", () => {
      mockedGetState.mockReturnValue(mockThemeState("bg-theme", { canvasBg: "#F2EFF6" }) as ReturnType<typeof useThemeStore.getState>);

      const result = getCanvasBgColor();

      expect(mockedHexToPixi).toHaveBeenCalledWith("#F2EFF6");
      expect(result).toBe(0xf2eff6);
    });

    it("reads from the current theme state each call (no caching)", () => {
      mockedGetState.mockReturnValue(mockThemeState("bg-1", { canvasBg: "#AAAAAA" }) as ReturnType<typeof useThemeStore.getState>);
      getCanvasBgColor();

      mockedGetState.mockReturnValue(mockThemeState("bg-2", { canvasBg: "#BBBBBB" }) as ReturnType<typeof useThemeStore.getState>);
      const result = getCanvasBgColor();

      expect(mockedHexToPixi).toHaveBeenCalledWith("#BBBBBB");
      expect(result).toBe(0xbbbbbb);
    });
  });

  describe("getHitLineColor", () => {
    it("returns the hit line color as a PixiJS number", () => {
      mockedGetState.mockReturnValue(mockThemeState("hl-theme", { hitLine: "#705A87" }) as ReturnType<typeof useThemeStore.getState>);

      const result = getHitLineColor();

      expect(mockedHexToPixi).toHaveBeenCalledWith("#705A87");
      expect(result).toBe(0x705a87);
    });

    it("reads from the current theme state each call (no caching)", () => {
      mockedGetState.mockReturnValue(mockThemeState("hl-1", { hitLine: "#CCCCCC" }) as ReturnType<typeof useThemeStore.getState>);
      getHitLineColor();

      mockedGetState.mockReturnValue(mockThemeState("hl-2", { hitLine: "#DDDDDD" }) as ReturnType<typeof useThemeStore.getState>);
      const result = getHitLineColor();

      expect(mockedHexToPixi).toHaveBeenCalledWith("#DDDDDD");
      expect(result).toBe(0xdddddd);
    });
  });
});
