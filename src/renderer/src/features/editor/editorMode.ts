export type EditorTool = "select" | "draw" | "erase";

export interface EditorModeState {
  tool: EditorTool;
  quantizeEnabled: boolean;
  selectedNoteIds: string[];
  clipboardNoteIds: string[];
  pendingPaste: boolean;
}

export type EditorModeAction =
  | { type: "set-tool"; tool: EditorTool }
  | { type: "toggle-quantize" }
  | { type: "copy" }
  | { type: "paste" }
  | { type: "none" };

export interface EditorShortcutInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isTypingTarget?: boolean;
}

export function createInitialEditorModeState(): EditorModeState {
  return {
    tool: "select",
    quantizeEnabled: true,
    selectedNoteIds: [],
    clipboardNoteIds: [],
    pendingPaste: false,
  };
}

export function canCopySelection(state: EditorModeState): boolean {
  return state.selectedNoteIds.length > 0;
}

export function canPasteClipboard(state: EditorModeState): boolean {
  return state.clipboardNoteIds.length > 0;
}

export function applyEditorModeAction(
  state: EditorModeState,
  action: EditorModeAction,
): EditorModeState {
  switch (action.type) {
    case "set-tool":
      return { ...state, tool: action.tool, pendingPaste: false };
    case "toggle-quantize":
      return {
        ...state,
        quantizeEnabled: !state.quantizeEnabled,
        pendingPaste: false,
      };
    case "copy":
      if (!canCopySelection(state)) return state;
      return {
        ...state,
        clipboardNoteIds: [...state.selectedNoteIds],
        pendingPaste: false,
      };
    case "paste":
      if (!canPasteClipboard(state)) return state;
      return { ...state, pendingPaste: true };
    case "none":
      return state;
  }
}

export function resolveEditorModeShortcut(
  input: EditorShortcutInput,
): EditorModeAction {
  if (input.isTypingTarget || input.altKey) return { type: "none" };

  const key = input.key.toLowerCase();
  const primaryModifier = input.metaKey || input.ctrlKey;
  if (primaryModifier) {
    if (key === "c") return { type: "copy" };
    if (key === "v") return { type: "paste" };
    return { type: "none" };
  }

  if (input.shiftKey) return { type: "none" };
  if (key === "v") return { type: "set-tool", tool: "select" };
  if (key === "d") return { type: "set-tool", tool: "draw" };
  if (key === "e") return { type: "set-tool", tool: "erase" };
  if (key === "q") return { type: "toggle-quantize" };

  return { type: "none" };
}
