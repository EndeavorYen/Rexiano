import { describe, expect, test, vi } from "vitest";
import { syncFallingNotesSize } from "./fallingNotesResize";

describe("syncFallingNotesSize", () => {
  test("resizes the Pixi renderer before re-laying out keys", () => {
    const calls: string[] = [];
    const app = {
      screen: { width: 640 },
      resize: vi.fn(() => {
        calls.push("app");
        app.screen.width = 1024;
      }),
    };
    const renderer = {
      resize: vi.fn((width: number) => {
        calls.push(`renderer:${width}`);
      }),
    };

    syncFallingNotesSize(app, renderer);

    expect(calls).toEqual(["app", "renderer:1024"]);
  });
});
