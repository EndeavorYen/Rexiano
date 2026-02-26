import { describe, test, expect } from "vitest";
import {
  getStatusLevel,
  STATUS_COLORS,
  STATUS_LABELS,
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

  describe("STATUS_LABELS", () => {
    test('each label contains "MIDI"', () => {
      for (const label of Object.values(STATUS_LABELS)) {
        expect(label).toContain("MIDI");
      }
    });

    test("connected label indicates connection", () => {
      expect(STATUS_LABELS.connected).toContain("connected");
    });

    test("disconnected label indicates disconnection", () => {
      expect(STATUS_LABELS.disconnected).toContain("disconnected");
    });

    test("error label indicates error", () => {
      expect(STATUS_LABELS.error).toContain("error");
    });
  });
});
