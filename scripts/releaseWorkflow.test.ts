import { describe, expect, test } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("release workflow", () => {
  test("runs Linux packaging through pnpm so local binaries resolve", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/release.yml"),
      "utf-8",
    );

    expect(workflow).toContain(
      "run: pnpm exec electron-vite build && pnpm exec electron-builder --linux AppImage deb",
    );
    expect(workflow).not.toContain(
      "run: electron-vite build && electron-builder --linux AppImage deb",
    );
  });
});
