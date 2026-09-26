import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const appSource = readFileSync(
  resolve(process.cwd(), "src/renderer/src/App.tsx"),
  "utf8",
);
const editorModule = resolve(
  process.cwd(),
  "src/renderer/src/features/editor/PianoRollEditor.tsx",
);

describe("live path editor absence", () => {
  test("playback App does not mount the piano-roll editor", () => {
    expect(appSource).not.toContain('data-testid="open-editor"');
    expect(appSource).not.toContain("PianoRollEditor");
    expect(appSource).not.toContain("showEditor");
  });

  test("editor module stays in the tree", () => {
    expect(existsSync(editorModule)).toBe(true);
  });
});
