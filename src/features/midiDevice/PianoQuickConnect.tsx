import { useCallback, useState } from "react";
import { Bluetooth, Piano } from "lucide-react";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { getBluetoothConnectedLabel } from "./bluetoothDeviceDisplay";
import {
  currentPianoBrowserSupport,
  type PianoBrowserSupport,
} from "./pianoBrowserSupport";

interface PianoQuickConnectProps {
  /** Opens the full piano panel (settings or the MIDI drawer). */
  onOpenDetails?: () => void;
  variant?: "card" | "pill";
  testId?: string;
  triggerRef?: React.Ref<HTMLButtonElement>;
}

/**
 * One-tap piano status: a card on the home screen, a floating pill in the
 * library. Tapping "Connect" pairs straight away; everything else (Bluefy
 * help, sound source, other ports) lives behind onOpenDetails.
 */
export function PianoQuickConnect({
  onOpenDetails,
  variant = "card",
  testId,
  triggerRef,
}: PianoQuickConnectProps): React.JSX.Element {
  const { t } = useTranslation();
  const bleStatus = useMidiDeviceStore((s) => s.bleStatus);
  const bleDeviceName = useMidiDeviceStore((s) => s.bleDeviceName);
  const connectBluetooth = useMidiDeviceStore((s) => s.connectBluetooth);
  const [support] = useState<PianoBrowserSupport>(currentPianoBrowserSupport);

  const connected = getBluetoothConnectedLabel(
    bleStatus === "connected",
    bleDeviceName,
    t("midi.bleConnectedDevice"),
  );
  const busy = bleStatus === "scanning" || bleStatus === "connecting";

  const handleClick = useCallback(() => {
    if (connected || support !== "ok") {
      onOpenDetails?.();
      return;
    }
    void connectBluetooth();
  }, [connectBluetooth, connected, onOpenDetails, support]);

  const label = connected
    ? t("piano.connectedTo", { name: connected })
    : busy
      ? t("midi.bleConnecting")
      : support === "ok"
        ? t("piano.connect")
        : t("piano.howToConnect");

  if (variant === "pill") {
    return (
      <button
        ref={triggerRef}
        onClick={onOpenDetails}
        className={`fixed right-5 bottom-5 z-30 flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold cursor-pointer ${connected ? "btn-surface-themed" : "btn-primary-themed"}`}
        style={{ boxShadow: "var(--family-shadow)" }}
        data-testid={testId}
      >
        <StatusDot on={!!connected} />
        <Piano size={16} />
        {connected ? connected : t("piano.title")}
      </button>
    );
  }

  return (
    <div
      className="set-card"
      style={{ flexDirection: "row", alignItems: "center" }}
      data-testid={testId}
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
        style={{
          background: connected
            ? "color-mix(in srgb, var(--color-success-text) 16%, var(--color-surface))"
            : "var(--color-surface-alt)",
          color: connected
            ? "var(--color-success-text)"
            : "var(--color-text-muted)",
        }}
        aria-hidden="true"
      >
        <Piano size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-bold">
          {connected
            ? t("piano.connectedTo", { name: connected })
            : t("piano.notConnected")}
        </p>
        <p className="m-0 text-sm" style={{ color: "var(--color-text-muted)" }}>
          {connected ? t("piano.connectedHint") : t("piano.homeHint")}
        </p>
      </div>
      <button
        onClick={handleClick}
        disabled={busy}
        className={`flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-bold cursor-pointer ${connected ? "btn-ghost-themed" : "btn-primary-themed"}`}
      >
        {!connected && support === "ok" && <Bluetooth size={16} />}
        {connected ? t("piano.manage") : label}
      </button>
    </div>
  );
}

function StatusDot({ on }: { on: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 rounded-full"
      style={{ background: on ? "#2E9E5B" : "#9AA6BA" }}
    />
  );
}
