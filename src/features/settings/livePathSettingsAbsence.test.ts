import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const panelSource = readFileSync(
  resolve(process.cwd(), "src/features/settings/SettingsPanel.tsx"),
  "utf8",
);

describe("live path settings", () => {
  test("settings is one column of family cards with the agreed controls", () => {
    // Appearance, language, sound, piano and backup.
    expect(panelSource).toContain("settings-appearance");
    expect(panelSource).toContain("settings-language");
    expect(panelSource).toContain('data-testid="volume-slider"');
    expect(panelSource).toContain('data-testid="toggle-mute"');
    expect(panelSource).toContain("<DeviceSelector");
    expect(panelSource).toContain("piano-latency-slider");
    expect(panelSource).toContain("user-data-export");
    expect(panelSource).toContain("user-data-import");
  });

  test("dropped chrome stays dropped", () => {
    expect(panelSource).not.toContain("settings.tab.display");
    expect(panelSource).not.toContain("settings.tab.practice");
    expect(panelSource).not.toContain("settings.tab.keys");
    expect(panelSource).not.toContain("settings.tab.about");
    expect(panelSource).not.toContain("latencyCompensation");
    expect(panelSource).not.toContain("childFocusMode");
  });
});
