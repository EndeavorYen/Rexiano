import { Plus, Trash2 } from "lucide-react";
import type { EditableSong, EditableTrack } from "./editorTypes";

interface TrackManagerProps {
  song: EditableSong;
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  onAddTrack: () => void;
  onDeleteTrack: (trackId: string) => void;
  onUpdateTrack: (
    trackId: string,
    patch: Partial<Pick<EditableTrack, "name" | "channel" | "instrument">>,
  ) => void;
}

export function TrackManager({
  song,
  selectedTrackId,
  onSelectTrack,
  onAddTrack,
  onDeleteTrack,
  onUpdateTrack,
}: TrackManagerProps): React.JSX.Element {
  const selectedTrack =
    song.tracks.find((track) => track.id === selectedTrackId) ?? null;

  return (
    <section
      className="w-[184px] shrink-0 space-y-3 border-l px-3 py-3"
      style={{
        borderColor: "var(--color-border)",
        background:
          "color-mix(in srgb, var(--color-surface-alt) 42%, var(--color-surface))",
      }}
      data-testid="track-manager"
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-[11px] font-display font-bold uppercase tracking-wider"
          style={{ color: "var(--color-text-muted)" }}
        >
          Tracks
        </p>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{
            color: "var(--color-accent)",
            background:
              "color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))",
            border:
              "1px solid color-mix(in srgb, var(--color-accent) 24%, var(--color-border))",
          }}
          title="Add track"
          aria-label="Add track"
          onClick={onAddTrack}
          data-testid="track-add"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="space-y-1">
        {song.tracks.map((track) => {
          const selected = track.id === selectedTrackId;
          return (
            <button
              key={track.id}
              type="button"
              className="flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-xs font-body"
              style={{
                color: selected ? "var(--color-accent)" : "var(--color-text)",
                background: selected
                  ? "color-mix(in srgb, var(--color-accent) 11%, var(--color-surface))"
                  : "var(--color-surface)",
                border: selected
                  ? "1px solid color-mix(in srgb, var(--color-accent) 28%, var(--color-border))"
                  : "1px solid var(--color-border)",
              }}
              onClick={() => onSelectTrack(track.id)}
              data-testid="track-select"
            >
              <span className="truncate">{track.name}</span>
              <span className="font-mono text-[10px] opacity-70">
                ch {track.channel + 1}
              </span>
            </button>
          );
        })}
      </div>

      {selectedTrack && (
        <div className="space-y-2" data-testid="track-metadata">
          <TrackInput
            label="Name"
            value={selectedTrack.name}
            onCommit={(value) =>
              onUpdateTrack(selectedTrack.id, { name: value })
            }
            testId="track-name"
          />
          <TrackInput
            label="Channel"
            value={String(selectedTrack.channel)}
            type="number"
            onCommit={(value) =>
              onUpdateTrack(selectedTrack.id, { channel: Number(value) })
            }
            testId="track-channel"
          />
          <TrackInput
            label="Instrument"
            value={String(selectedTrack.instrument ?? 0)}
            type="number"
            onCommit={(value) =>
              onUpdateTrack(selectedTrack.id, { instrument: Number(value) })
            }
            testId="track-instrument"
          />
          <button
            type="button"
            className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-xs font-body font-semibold"
            style={{
              color: "#b42318",
              background:
                "color-mix(in srgb, #f04438 8%, var(--color-surface))",
              border:
                "1px solid color-mix(in srgb, #f04438 24%, var(--color-border))",
            }}
            onClick={() => onDeleteTrack(selectedTrack.id)}
            disabled={song.tracks.length <= 1}
            data-testid="track-delete"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      )}
    </section>
  );
}

function TrackInput({
  label,
  value,
  onCommit,
  testId,
  type = "text",
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  testId: string;
  type?: "text" | "number";
}): React.JSX.Element {
  return (
    <label className="block">
      <span
        className="mb-1 block text-[10px] font-body font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        {label}
      </span>
      <input
        key={`${testId}-${value}`}
        type={type}
        defaultValue={value}
        className="h-8 w-full rounded-md px-2 text-xs font-mono outline-none"
        style={{
          color: "var(--color-text)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
        onBlur={(event) => onCommit(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        data-testid={testId}
      />
    </label>
  );
}
