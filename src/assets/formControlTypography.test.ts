import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

describe("form control typography reset", () => {
  test("keeps the inherit reset inside the base layer so utilities win", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "main.css"),
      "utf8",
    );
    const baseLayerMatch = css.match(/@layer base\s*\{[\s\S]*?\n\}/m);
    expect(baseLayerMatch?.[0]).toMatch(
      /button,\s*\n\s*input,\s*\n\s*select,\s*\n\s*textarea\s*\{\s*\n\s*font:\s*inherit;/,
    );

    const withoutLayerBlocks = css.replace(
      /@layer\s+\w+\s*\{[\s\S]*?\n\}/g,
      "",
    );
    expect(withoutLayerBlocks).not.toMatch(
      /button,\s*\n\s*input,\s*\n\s*select,\s*\n\s*textarea\s*\{\s*\n\s*font:\s*inherit;/,
    );
  });
});
