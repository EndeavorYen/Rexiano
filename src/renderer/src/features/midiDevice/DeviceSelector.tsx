import { useEffect, useCallback, useState, useRef } from "react";
import { Bluetooth } from "lucide-react";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { MidiDeviceManager } from "@renderer/engines/midi/MidiDeviceManager";
import { MidiOutputSender } from "@renderer/engines/midi/MidiOutputSender";
import { ConnectionStatus } from "./ConnectionStatus";
import { sendTestNote, type TestButtonState } from "./midiTestUtils";
import { useTranslation } from "@renderer/i18n/useTranslation";

export function DeviceSelector(): React.JSX.Element {
  const { t } = useTranslation();
  const inputs = useMidiDeviceStore((s) => s.inputs);
  const outputs = useMidiDeviceStore((s) => s.outputs);
  const selectedInputId = useMidiDeviceStore((s) => s.selectedInputId);
  const selectedOutputId = useMidiDeviceStore((s) => s.selectedOutputId);
  const isConnected = useMidiDeviceStore((s) => s.isConnected);
  const connectionError = useMidiDeviceStore((s) => s.connectionError);
  const connect = useMidiDeviceStore((s) => s.connect);
  const disconnect = useMidiDeviceStore((s) => s.disconnect);
  const selectInput = useMidiDeviceStore((s) => s.selectInput);
  const selectOutput = useMidiDeviceStore((s) => s.selectOutput);
  const bleStatus = useMidiDeviceStore((s) => s.bleStatus);
  const bleDeviceName = useMidiDeviceStore((s) => s.bleDeviceName);
  const connectBluetooth = useMidiDeviceStore((s) => s.connectBluetooth);
  const disconnectBluetooth = useMidiDeviceStore((s) => s.disconnectBluetooth);

  // Test button state
  const [testState, setTestState] = useState<TestButtonState>("idle");
  const okTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-init MIDI access on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Cleanup ok timer on unmount
  useEffect(() => {
    return () => {
      if (okTimerRef.current) clearTimeout(okTimerRef.current);
    };
  }, []);

  const handleTestClick = useCallback(async () => {
    if (testState !== "idle") return;

    const manager = MidiDeviceManager.getInstance();
    const output = manager.getActiveOutput();
    if (!output) return;

    setTestState("playing");
    try {
      const sender = new MidiOutputSender();
      await sendTestNote(sender, output);
      setTestState("ok");
      okTimerRef.current = setTimeout(() => {
        setTestState("idle");
        okTimerRef.current = null;
      }, 1500);
    } catch {
      setTestState("idle");
    }
  }, [testState]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      selectInput(val || null);
    },
    [selectInput],
  );

  const handleOutputChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      selectOutput(val || null);
    },
    [selectOutput],
  );

  const connectedInputs = inputs.filter((d) => d.state === "connected");
  const connectedOutputs = outputs.filter((d) => d.state === "connected");
  const noDevices =
    connectedInputs.length === 0 && connectedOutputs.length === 0;

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
                aria-label="MIDI input device"
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

          {/* Output device select */}
          {connectedOutputs.length > 0 && (
            <label
              className="flex items-center gap-1.5 rounded-lg px-2 py-1"
              style={{
                background:
                  "color-mix(in srgb, var(--color-surface) 75%, transparent)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span style={{ color: "var(--color-text-muted)" }}>
                {t("midi.outputLabel")}
              </span>
              <select
                value={selectedOutputId ?? ""}
                onChange={handleOutputChange}
                className="select-themed rounded px-2 py-1 text-xs outline-none cursor-pointer"
                aria-label="MIDI output device"
              >
                <option value="">{t("midi.noneOption")}</option>
                {connectedOutputs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Test output button — visible only when an output device is selected */}
          {selectedOutputId && (
            <button
              onClick={handleTestClick}
              disabled={testState !== "idle"}
              className="btn-surface-themed px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
              style={{
                background:
                  testState === "ok" ? "#22c55e" : "var(--color-surface)",
                color: testState === "ok" ? "#fff" : "var(--color-text)",
                opacity: testState === "playing" ? 0.7 : 1,
              }}
              title={t("midi.testTitle")}
              aria-label={t("midi.testLabel")}
              data-testid="midi-test-button"
            >
              {testState === "idle"
                ? t("midi.testLabel")
                : testState === "playing"
                  ? t("midi.testPlaying")
                  : t("midi.testOk")}
            </button>
          )}
        </>
      )}

      {/* Connect / Disconnect button */}
      {isConnected ? (
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
      {bleStatus === "connected" && bleDeviceName ? (
        <button
          onClick={disconnectBluetooth}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer btn-primary-themed"
          style={{
            color: "#fff",
          }}
          title={t("midi.bleDeviceTitle", { name: bleDeviceName })}
          aria-label={t("midi.bleDisconnect")}
        >
          <Bluetooth size={12} />
          {bleDeviceName}
        </button>
      ) : (
        <button
          onClick={connectBluetooth}
          disabled={bleStatus === "scanning" || bleStatus === "connecting"}
          className="btn-surface-themed flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
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
      {connectionError && (
        <span
          className="text-xs truncate max-w-48"
          style={{ color: "#f87171" }}
          title={connectionError}
        >
          {connectionError}
        </span>
      )}
    </div>
  );
}
