import { useEffect, useCallback } from "react";
import { Bluetooth } from "lucide-react";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { ConnectionStatus } from "./ConnectionStatus";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { getMidiErrorGuidance } from "./midiErrorGuidance";
import { getBluetoothConnectedLabel } from "./bluetoothDeviceDisplay";

interface DeviceSelectorProps {
  onBeforeBluetoothConnect?: () => void;
}

export function DeviceSelector({
  onBeforeBluetoothConnect,
}: DeviceSelectorProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const inputs = useMidiDeviceStore((s) => s.inputs);
  const selectedInputId = useMidiDeviceStore((s) => s.selectedInputId);
  const connectionError = useMidiDeviceStore((s) => s.connectionError);
  const connect = useMidiDeviceStore((s) => s.connect);
  const disconnect = useMidiDeviceStore((s) => s.disconnect);
  const selectInput = useMidiDeviceStore((s) => s.selectInput);
  const bleStatus = useMidiDeviceStore((s) => s.bleStatus);
  const bleDeviceName = useMidiDeviceStore((s) => s.bleDeviceName);
  const connectBluetooth = useMidiDeviceStore((s) => s.connectBluetooth);
  const disconnectBluetooth = useMidiDeviceStore((s) => s.disconnectBluetooth);

  // Auto-init MIDI access on mount
  useEffect(() => {
    connect();
  }, [connect]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      selectInput(val || null);
    },
    [selectInput],
  );

  const connectedInputs = inputs.filter((d) => d.state === "connected");
  const noDevices = connectedInputs.length === 0;
  const errorGuidance = connectionError
    ? getMidiErrorGuidance(connectionError, t)
    : null;
  const recoveryActions =
    errorGuidance?.actions.filter(
      (action) =>
        action.id !== "connect-bluetooth-midi" || bleStatus !== "connected",
    ) ?? [];

  const handleBluetoothConnect = useCallback((): void => {
    onBeforeBluetoothConnect?.();
    window.requestAnimationFrame(() => {
      void connectBluetooth();
    });
  }, [connectBluetooth, onBeforeBluetoothConnect]);
  const bluetoothConnectedLabel = getBluetoothConnectedLabel(
    bleStatus === "connected",
    bleDeviceName,
    t("midi.bleConnectedDevice"),
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2.5 px-3 py-2 text-xs font-body"
      style={{ color: "var(--color-text)" }}
    >
      <ConnectionStatus />

      {noDevices && !connectionError ? (
        <span
          className="italic text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          {t("midi.noDevices")}
        </span>
      ) : (
        <>
          {/* Input device select */}
          {connectedInputs.length > 0 && (
            <label
              className="flex items-center gap-1.5 rounded-lg px-2 py-1"
              style={{
                background:
                  "color-mix(in srgb, var(--color-surface) 75%, transparent)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span style={{ color: "var(--color-text-muted)" }}>
                {t("midi.inputLabel")}
              </span>
              <select
                value={selectedInputId ?? ""}
                onChange={handleInputChange}
                className="select-themed rounded px-2 py-1 text-xs outline-none cursor-pointer"
                aria-label={t("midi.inputDevice")}
              >
                <option value="">{t("midi.noneOption")}</option>
                {connectedInputs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}

      {/* Connect / Disconnect button */}
      {selectedInputId ? (
        <button
          onClick={disconnect}
          className="btn-surface-themed px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
          style={{ color: "var(--color-text-muted)" }}
          title={t("midi.disconnectTitle")}
          aria-label={t("midi.disconnectTitle")}
        >
          {t("midi.disconnect")}
        </button>
      ) : null}

      {/* Bluetooth MIDI connect/disconnect */}
      {bluetoothConnectedLabel ? (
        <button
          onClick={disconnectBluetooth}
          className="flex min-h-9 items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer btn-primary-themed"
          style={{
            color: "var(--color-on-accent)",
          }}
          title={t("midi.bleDeviceTitle", {
            name: bluetoothConnectedLabel,
          })}
          aria-label={t("midi.bleDisconnect")}
        >
          <Bluetooth size={12} />
          {bluetoothConnectedLabel}
        </button>
      ) : (
        <button
          onClick={handleBluetoothConnect}
          disabled={bleStatus === "scanning" || bleStatus === "connecting"}
          className="btn-surface-themed flex min-h-9 items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
          style={{
            color: "var(--color-text-muted)",
            opacity:
              bleStatus === "scanning" || bleStatus === "connecting" ? 0.6 : 1,
          }}
          title={t("midi.bleConnect")}
          aria-label={t("midi.bluetooth")}
        >
          <Bluetooth size={12} />
          {bleStatus === "scanning"
            ? t("midi.bleScanning")
            : bleStatus === "connecting"
              ? t("midi.bleConnecting")
              : t("midi.bluetooth")}
        </button>
      )}

      {/* Error message */}
      {errorGuidance && (
        <div
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 max-w-[420px]"
          style={{
            color: "var(--color-danger-text)",
            background:
              "color-mix(in srgb, var(--color-danger-text) 8%, var(--color-surface))",
            border: "1px solid var(--color-danger-text)",
          }}
          data-testid="midi-error-guidance"
        >
          <span className="min-w-0" title={errorGuidance.title}>
            <span className="block text-xs font-semibold truncate">
              {errorGuidance.title}
            </span>
            <span
              className="block text-[10px] leading-snug"
              style={{ color: "var(--color-text-muted)" }}
            >
              {errorGuidance.guidance}
            </span>
          </span>
          {recoveryActions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                if (action.id === "connect-bluetooth-midi") {
                  handleBluetoothConnect();
                  return;
                }
                connect();
              }}
              disabled={
                action.id === "connect-bluetooth-midi" &&
                (bleStatus === "scanning" || bleStatus === "connecting")
              }
              className="px-1.5 py-0.5 rounded text-[10px] font-body font-medium cursor-pointer disabled:opacity-55 shrink-0"
              style={{
                color: "var(--color-text)",
                background:
                  "color-mix(in srgb, var(--color-surface-alt) 75%, var(--color-surface))",
                border: "1px solid var(--color-border)",
              }}
              data-recovery-action={action.id}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
