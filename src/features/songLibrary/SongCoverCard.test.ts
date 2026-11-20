import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { SongCoverCard, type SongCoverCardProps } from "./SongCoverCard";

function render(overrides: Partial<SongCoverCardProps> = {}): string {
  const props: SongCoverCardProps = {
    title: "小星星",
    durationSeconds: 80,
    stars: 0,
    color: "var(--color-note2)",
    contour: [0, 1, 2],
    seed: "twinkle",
    testId: "song-select-twinkle",
    onSelect: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(SongCoverCard, props));
}

describe("SongCoverCard", () => {
  test("is a real button with the testid and the unit color", () => {
    const html = render();
    expect(html.startsWith("<button")).toBe(true);
    expect(html).toContain('type="button"');
    expect(html).toContain('data-testid="song-select-twinkle"');
    expect(html).toContain("--c:var(--color-note2)");
  });

  test("the aria-label names the song, its length and the stars", () => {
    const html = render({ stars: 2 });
    const label = /aria-label="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(label).toContain("小星星");
    expect(label).toContain("1 分 20 秒");
    expect(label).toContain("2 顆星");
    expect(label).not.toContain("等級");
  });

  test("no badge when the song has no stars yet", () => {
    expect(render({ stars: 0 })).not.toContain('class="badge"');
    expect(render({ stars: 3 })).toContain('class="badge"');
  });

  test("the label shows only the length under the name, never a level", () => {
    const html = render({ durationSeconds: 16 });
    expect(html).toContain("16 秒");
    expect(html).not.toContain("等級");
  });

  test("a note replaces the length line", () => {
    const html = render({ durationSeconds: null, noteOverride: "遺失" });
    expect(html).toContain("遺失");
  });
});
