import { describe, test, expect } from "vitest";
import {
  getStatusLevel,
  STATUS_COLORS,
  STATUS_LABEL_KEYS,
} from "./ConnectionStatus";
import type { StatusLevel } from "./ConnectionStatus";

describe("ConnectionStatus helpers", () => {
  describe("getStatusLevel", () => {
    test('returns "connected" when connected and no error', () => {
      expect(getStatusLevel(true, null)).toBe("connected");
    });

    test('returns "disconnected" when not connected and no error', () => {
      expect(getStatusLevel(false, null)).toBe("disconnected");
    });

    test('returns "error" when there is a connection error', () => {
      expect(getStatusLevel(false, "MIDI denied")).toBe("error");
    });

    test('returns "error" even if isConnected is true but error exists', () => {
      expect(getStatusLevel(true, "Some error")).toBe("error");
    });
  });

  describe("STATUS_COLORS", () => {
    test("has distinct colors for each level", () => {
      const levels: StatusLevel[] = ["connected", "disconnected", "error"];
      const colors = new Set(levels.map((l) => STATUS_COLORS[l]));
      expect(colors.size).toBe(3);
    });

    test("all colors are valid CSS color strings", () => {
      for (const color of Object.values(STATUS_COLORS)) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });

  describe("STATUS_LABEL_KEYS", () => {
    test("has a translation key for each status level", () => {
      expect(STATUS_LABEL_KEYS.connected).toBe("midi.connected");
      expect(STATUS_LABEL_KEYS.disconnected).toBe("midi.disconnected");
      expect(STATUS_LABEL_KEYS.error).toBe("midi.error");
    });

    test("all keys follow the midi.* namespace", () => {
      for (const key of Object.values(STATUS_LABEL_KEYS)) {
        expect(key).toMatch(/^midi\./);
      }
    });
  });
});
