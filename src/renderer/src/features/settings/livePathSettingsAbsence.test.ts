import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const panelSource = readFileSync(
  resolve(
    process.cwd(),
    "src/renderer/src/features/settings/SettingsPanel.tsx",
  ),
  "utf8",
);

describe("live path settings absence", () => {
  test("settings panel presents only language and audio/volume controls", () => {
    // Surviving live controls
    expect(panelSource).toContain("settings.tab.lang");
    expect(panelSource).toContain("settings.tab.audio");
    expect(panelSource).toContain('data-testid="volume-slider"');
    expect(panelSource).toContain('data-testid="toggle-mute"');

    // Deleted live chrome
    expect(panelSource).not.toContain("settings.tab.theme");
    expect(panelSource).not.toContain("settings.tab.display");
    expect(panelSource).not.toContain("settings.tab.practice");
    expect(panelSource).not.toContain("settings.tab.keys");
    expect(panelSource).not.toContain("settings.tab.backup");
    expect(panelSource).not.toContain("settings.tab.about");
    expect(panelSource).not.toContain("latencyCompensation");
    expect(panelSource).not.toContain("ThemePicker");
  });

  test("backup, theme picker, and updater modules stay in the tree", () => {
    expect(
      existsSync(
        resolve(
          process.cwd(),
          "src/renderer/src/features/settings/ThemePicker.tsx",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          process.cwd(),
          "src/renderer/src/features/settings/userDataBackup.ts",
        ),
      ),
    ).toBe(true);
  });
});
