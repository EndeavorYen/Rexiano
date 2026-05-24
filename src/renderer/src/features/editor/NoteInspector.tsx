import { useState } from "react";
import type { EditableNotePatch } from "./editorCommands";
import type { EditableSong } from "./editorTypes";
import {
  buildNotePropertyPatch,
  getNotePropertyModel,
  type NotePropertyValue,
} from "./noteProperties";

interface NoteInspectorProps {
  song: EditableSong;
  selectedNoteIds: string[];
  onPatch: (patch: EditableNotePatch) => void;
}

type EditableField = "pitch" | "start" | "duration" | "velocity";

const labels: Record<EditableField, string> = {
  pitch: "Pitch",
  start: "Start",
  duration: "Duration",
  velocity: "Velocity",
};

export function NoteInspector({
  song,
  selectedNoteIds,
  onPatch,
}: NoteInspectorProps): React.JSX.Element {
  const model = getNotePropertyModel(song, selectedNoteIds);
  const [warnings, setWarnings] = useState<string[]>([]);

  const commitField = (field: EditableField, rawValue: string): void => {
    if (rawValue.trim() === "") return;
    const result = buildNotePropertyPatch({
      [field]: Number(rawValue),
    });
    if (Object.keys(result.patch).length > 0) {
      onPatch(result.patch);
    }
    setWarnings(result.warnings);
  };

  return (
    <aside
      className="flex w-[184px] shrink-0 flex-col gap-3 border-l px-3 py-3"
      style={{
        borderColor: "var(--color-border)",
        background:
          "color-mix(in srgb, var(--color-surface) 90%, var(--color-surface-alt))",
      }}
      data-testid="note-inspector"
    >
      <div>
        <p
          className="text-[11px] font-display font-bold uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          Notes
        </p>
        <p
          className="mt-1 text-xs font-body"
          style={{ color: "var(--color-text)" }}
          data-testid="note-inspector-selection"
        >
          {model.selectedCount === 0
            ? "No selection"
            : `${model.selectedCount} selected`}
        </p>
      </div>

      <div className="space-y-2">
        <PropertyInput
          field="pitch"
          value={model.pitch}
          selectedCount={model.selectedCount}
          batchEditable={false}
          onCommit={commitField}
        />
        <PropertyInput
          field="start"
          value={model.start}
          selectedCount={model.selectedCount}
          batchEditable={false}
          onCommit={commitField}
        />
        <PropertyInput
          field="duration"
          value={model.duration}
          selectedCount={model.selectedCount}
          batchEditable={true}
          onCommit={commitField}
        />
        <PropertyInput
          field="velocity"
          value={model.velocity}
          selectedCount={model.selectedCount}
          batchEditable={true}
          onCommit={commitField}
        />
      </div>

      {warnings.length > 0 && (
        <div
          className="rounded-md px-2 py-1.5 text-[10px] leading-snug"
          style={{
            color: "#92400e",
            background:
              "color-mix(in srgb, var(--color-streak-gold) 18%, var(--color-surface))",
            border:
              "1px solid color-mix(in srgb, var(--color-streak-gold) 42%, transparent)",
          }}
          role="status"
          data-testid="note-inspector-warning"
        >
          {warnings[0]}
        </div>
      )}
    </aside>
  );
}

function getInputValue(value: NotePropertyValue): string {
  return value.kind === "value" ? String(value.value) : "";
}

function getPlaceholder(value: NotePropertyValue): string {
  if (value.kind === "mixed") return "Mixed";
  if (value.kind === "empty") return "None";
  return "";
}

function PropertyInput({
  field,
  value,
  selectedCount,
  batchEditable,
  onCommit,
}: {
  field: EditableField;
  value: NotePropertyValue;
  selectedCount: number;
  batchEditable: boolean;
  onCommit: (field: EditableField, value: string) => void;
}): React.JSX.Element {
  const disabled = selectedCount === 0 || (selectedCount > 1 && !batchEditable);
  return (
    <label className="block">
      <span
        className="mb-1 block text-[10px] font-body font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {labels[field]}
      </span>
      <input
        key={`${field}-${selectedCount}-${value.kind}-${getInputValue(value)}`}
        type="number"
        step={field === "duration" || field === "start" ? 0.03125 : 1}
        defaultValue={getInputValue(value)}
        placeholder={getPlaceholder(value)}
        disabled={disabled}
        className="h-8 w-full rounded-md px-2 text-xs font-mono outline-none disabled:opacity-50"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        onBlur={(event) => onCommit(field, event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        data-testid={`note-property-${field}`}
      />
    </label>
  );
}
