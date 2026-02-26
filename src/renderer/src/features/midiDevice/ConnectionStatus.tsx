import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";

type StatusLevel = "connected" | "disconnected" | "error";

function getStatusLevel(
  isConnected: boolean,
  connectionError: string | null,
): StatusLevel {
  if (connectionError) return "error";
  if (isConnected) return "connected";
  return "disconnected";
}

/** Intentionally fixed colors (not theme vars) — green/gray/red carry
 *  universal semantic meaning for connection state and need guaranteed
 *  contrast across all three themes (Lavender/Ocean/Peach). */
const STATUS_COLORS: Record<StatusLevel, string> = {
  connected: "#4ade80",
  disconnected: "#9ca3af",
  error: "#f87171",
};

const STATUS_LABELS: Record<StatusLevel, string> = {
  connected: "MIDI connected",
  disconnected: "MIDI disconnected",
  error: "MIDI error",
};

export function ConnectionStatus(): React.JSX.Element {
  const isConnected = useMidiDeviceStore((s) => s.isConnected);
  const connectionError = useMidiDeviceStore((s) => s.connectionError);

  const level = getStatusLevel(isConnected, connectionError);
  const color = STATUS_COLORS[level];
  const label = STATUS_LABELS[level];

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-body"
      title={connectionError ?? label}
      aria-label={label}
    >
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{
          background: color,
          boxShadow: level === "connected" ? `0 0 6px ${color}` : "none",
        }}
      />
      <span style={{ color: "var(--color-text-muted)" }}>MIDI</span>
    </span>
  );
}

// Export for testing
// eslint-disable-next-line react-refresh/only-export-components
export { getStatusLevel, STATUS_COLORS, STATUS_LABELS };
export type { StatusLevel };
