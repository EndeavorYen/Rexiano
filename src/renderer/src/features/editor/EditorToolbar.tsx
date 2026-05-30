import {
  ClipboardPaste,
  Copy,
  Eraser,
  Magnet,
  MousePointer2,
  Pencil,
} from "lucide-react";
import {
  canCopySelection,
  canPasteClipboard,
  type EditorModeAction,
  type EditorModeState,
  type EditorTool,
} from "./editorMode";

interface EditorToolbarProps {
  state: EditorModeState;
  onAction: (action: EditorModeAction) => void;
}

const toolButtons: {
  tool: EditorTool;
  label: string;
  icon: React.ReactNode;
  testId: string;
}[] = [
  {
    tool: "select",
    label: "Select tool",
    icon: <MousePointer2 size={16} />,
    testId: "editor-tool-select",
  },
  {
    tool: "draw",
    label: "Draw tool",
    icon: <Pencil size={16} />,
    testId: "editor-tool-draw",
  },
  {
    tool: "erase",
    label: "Erase tool",
    icon: <Eraser size={16} />,
    testId: "editor-tool-erase",
  },
];

export function EditorToolbar({
  state,
  onAction,
}: EditorToolbarProps): React.JSX.Element {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1"
      style={{
        background:
          "color-mix(in srgb, var(--color-surface-alt) 62%, var(--color-surface))",
        border: "1px solid var(--color-border)",
      }}
      role="toolbar"
      aria-label="Piano roll editor tools"
      data-testid="editor-toolbar"
    >
      {toolButtons.map((button) => (
        <ToolbarButton
          key={button.tool}
          label={button.label}
          active={state.tool === button.tool}
          onClick={() => onAction({ type: "set-tool", tool: button.tool })}
          testId={button.testId}
        >
          {button.icon}
        </ToolbarButton>
      ))}

      <span
        className="mx-1 h-5 w-px"
        style={{ background: "var(--color-border)" }}
      />

      <ToolbarButton
        label="Toggle quantize"
        active={state.quantizeEnabled}
        onClick={() => onAction({ type: "toggle-quantize" })}
        testId="editor-quantize"
      >
        <Magnet size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Copy selection"
        disabled={!canCopySelection(state)}
        onClick={() => onAction({ type: "copy" })}
        testId="editor-copy"
      >
        <Copy size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Paste notes"
        disabled={!canPasteClipboard(state)}
        onClick={() => onAction({ type: "paste" })}
        testId="editor-paste"
      >
        <ClipboardPaste size={16} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
  testId,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  testId: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        color: active ? "var(--color-accent)" : "var(--color-text-muted)",
        background: active
          ? "color-mix(in srgb, var(--color-accent) 12%, var(--color-surface))"
          : "transparent",
        border: active
          ? "1px solid color-mix(in srgb, var(--color-accent) 26%, var(--color-border))"
          : "1px solid transparent",
      }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
