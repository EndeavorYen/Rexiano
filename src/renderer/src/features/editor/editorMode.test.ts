import { describe, expect, test } from "vitest";
import {
  applyEditorModeAction,
  createInitialEditorModeState,
  resolveEditorModeShortcut,
} from "./editorMode";

describe("editorMode", () => {
  test("starts in select mode with quantize enabled", () => {
    expect(createInitialEditorModeState()).toEqual({
      tool: "select",
      quantizeEnabled: true,
      selectedNoteIds: [],
      clipboardNoteIds: [],
      pendingPaste: false,
    });
  });

  test("switches tools without losing selection or clipboard", () => {
    const state = {
      ...createInitialEditorModeState(),
      selectedNoteIds: ["note-1"],
      clipboardNoteIds: ["note-2"],
      pendingPaste: true,
    };

    expect(
      applyEditorModeAction(state, { type: "set-tool", tool: "draw" }),
    ).toEqual({
      ...state,
      tool: "draw",
      pendingPaste: false,
    });
  });

  test("copies only when notes are selected", () => {
    const empty = createInitialEditorModeState();
    expect(applyEditorModeAction(empty, { type: "copy" })).toEqual(empty);

    const selected = {
      ...empty,
      selectedNoteIds: ["note-1", "note-2"],
    };
    expect(applyEditorModeAction(selected, { type: "copy" })).toMatchObject({
      clipboardNoteIds: ["note-1", "note-2"],
      pendingPaste: false,
    });
  });

  test("pastes only when the clipboard has notes", () => {
    const empty = createInitialEditorModeState();
    expect(applyEditorModeAction(empty, { type: "paste" })).toEqual(empty);

    expect(
      applyEditorModeAction(
        { ...empty, clipboardNoteIds: ["note-1"] },
        { type: "paste" },
      ),
    ).toMatchObject({ pendingPaste: true });
  });

  test("toggles quantize without changing the active tool", () => {
    const state = applyEditorModeAction(createInitialEditorModeState(), {
      type: "toggle-quantize",
    });

    expect(state.tool).toBe("select");
    expect(state.quantizeEnabled).toBe(false);
  });

  test.each([
    ["v", { type: "set-tool", tool: "select" }],
    ["d", { type: "set-tool", tool: "draw" }],
    ["e", { type: "set-tool", tool: "erase" }],
    ["q", { type: "toggle-quantize" }],
  ] as const)("maps %s to editor-only shortcuts", (key, expected) => {
    expect(resolveEditorModeShortcut({ key })).toEqual(expected);
  });

  test("maps platform copy and paste shortcuts", () => {
    expect(resolveEditorModeShortcut({ key: "c", metaKey: true })).toEqual({
      type: "copy",
    });
    expect(resolveEditorModeShortcut({ key: "v", ctrlKey: true })).toEqual({
      type: "paste",
    });
  });

  test.each([" ", "1", "2", "3", "l", "m", "r", "ArrowLeft"])(
    "ignores practice-mode shortcut %s",
    (key) => {
      expect(resolveEditorModeShortcut({ key })).toEqual({ type: "none" });
    },
  );

  test("ignores shortcuts while typing into form fields", () => {
    expect(
      resolveEditorModeShortcut({ key: "d", isTypingTarget: true }),
    ).toEqual({
      type: "none",
    });
  });
});
