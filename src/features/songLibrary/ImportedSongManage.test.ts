import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ImportedSongManage } from "./ImportedSongManage";
import { ImportedSongMetadataEditor } from "./ImportedSongRow";

const noop = (): void => undefined;

function manage(confirmingRemove: boolean): string {
  return renderToStaticMarkup(
    createElement(ImportedSongManage, {
      title: "我的曲子",
      isEditing: false,
      confirmingRemove,
      onEdit: noop,
      onAskRemove: noop,
      onConfirmRemove: noop,
      onCancelRemove: noop,
    }),
  );
}

describe("ImportedSongManage", () => {
  test("first step: edit and remove, nothing is deleted yet", () => {
    const html = manage(false);
    expect(html).toContain('data-testid="imported-song-edit"');
    expect(html).toContain('data-testid="imported-song-remove"');
    expect(html).not.toContain("imported-song-remove-confirm");
  });

  test("second step: one question, confirm and not-now replace the row", () => {
    const html = manage(true);
    expect(html).toContain("要移除「我的曲子」嗎？成績會留著，檔案會刪掉。");
    expect(html).toContain('data-testid="imported-song-remove-confirm"');
    expect(html).toContain("先不要");
    expect(html).not.toContain('data-testid="imported-song-remove"');
  });
});

describe("ImportedSongMetadataEditor", () => {
  const html = renderToStaticMarkup(
    createElement(ImportedSongMetadataEditor, {
      draft: { title: "歌", composer: "X", tags: "a", category: "", grade: "" },
      onChange: noop,
      onSave: noop,
      onCancel: noop,
    }),
  );

  test("has the name field only", () => {
    expect(html).toContain('data-testid="imported-song-title-input"');
    expect(html).not.toContain("imported-song-composer-input");
    expect(html).not.toContain("imported-song-tags-input");
    expect(html).not.toContain("imported-song-category-select");
  });

  test("save and cancel are text buttons, no English metadata labels", () => {
    expect(html).toContain(">儲存<");
    expect(html).toContain(">取消<");
    expect(html).not.toMatch(/aria-label="[^"]*[Mm]etadata/);
  });
});
