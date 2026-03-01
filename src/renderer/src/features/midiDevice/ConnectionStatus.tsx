import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TranslationKey } from "@renderer/i18n/types";

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

/** Maps connection status levels to their i18n translation keys. */
const STATUS_LABEL_KEYS: Record<StatusLevel, TranslationKey> = {
  connected: "midi.connected",
  disconnected: "midi.disconnected",
  error: "midi.error",
};

export function ConnectionStatus(): React.JSX.Element {
  const { t } = useTranslation();
  const isConnected = useMidiDeviceStore((s) => s.isConnected);
  const connectionError = useMidiDeviceStore((s) => s.connectionError);

  const level = getStatusLevel(isConnected, connectionError);
  const color = STATUS_COLORS[level];
  const label = t(STATUS_LABEL_KEYS[level]);

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
export { getStatusLevel, STATUS_COLORS, STATUS_LABEL_KEYS };
export type { StatusLevel };
