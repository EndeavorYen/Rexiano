import { useEffect, useCallback, useState, useRef } from "react";
import { Bluetooth } from "lucide-react";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { MidiDeviceManager } from "@renderer/engines/midi/MidiDeviceManager";
import { MidiOutputSender } from "@renderer/engines/midi/MidiOutputSender";
import { ConnectionStatus } from "./ConnectionStatus";
import { sendTestNote, type TestButtonState } from "./midiTestUtils";

export function DeviceSelector(): React.JSX.Element {
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
      className="flex items-center gap-3 px-3 py-1.5 text-xs font-body"
      style={{ color: "var(--color-text)" }}
    >
      <ConnectionStatus />

      {noDevices && !connectionError ? (
        <span
          className="italic text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          No MIDI devices detected
        </span>
      ) : (
        <>
          {/* Input device select */}
          {connectedInputs.length > 0 && (
            <label className="flex items-center gap-1.5">
              <span style={{ color: "var(--color-text-muted)" }}>In</span>
              <select
                value={selectedInputId ?? ""}
                onChange={handleInputChange}
                className="rounded px-2 py-1 text-xs outline-none cursor-pointer"
                style={{
                  background: "var(--color-surface-alt)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
                aria-label="MIDI input device"
              >
                <option value="">-- None --</option>
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
            <label className="flex items-center gap-1.5">
              <span style={{ color: "var(--color-text-muted)" }}>Out</span>
              <select
                value={selectedOutputId ?? ""}
                onChange={handleOutputChange}
                className="rounded px-2 py-1 text-xs outline-none cursor-pointer"
                style={{
                  background: "var(--color-surface-alt)",
                  color: "var(--color-text)",
                  border: "1px solid var(--color-border)",
                }}
                aria-label="MIDI output device"
              >
                <option value="">-- None --</option>
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
              className="px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
              style={{
                background:
                  testState === "ok"
                    ? "#22c55e"
                    : "var(--color-surface)",
                color:
                  testState === "ok"
                    ? "#fff"
                    : "var(--color-text)",
                border: "1px solid var(--color-border)",
                opacity: testState === "playing" ? 0.7 : 1,
              }}
              title="Send a test note (C4) to the selected MIDI output"
              aria-label="Test MIDI output"
              data-testid="midi-test-button"
            >
              {testState === "idle"
                ? "Test"
                : testState === "playing"
                  ? "Playing..."
                  : "OK!"}
            </button>
          )}
        </>
      )}

      {/* Connect / Disconnect button */}
      {isConnected ? (
        <button
          onClick={disconnect}
          className="px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
          style={{
            background: "var(--color-surface-alt)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
          }}
          title="Disconnect MIDI device"
          aria-label="Disconnect MIDI device"
        >
          Disconnect
        </button>
      ) : null}

      {/* Bluetooth MIDI connect/disconnect */}
      {bleStatus === "connected" && bleDeviceName ? (
        <button
          onClick={disconnectBluetooth}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
          style={{
            background: "#3b82f6",
            color: "#fff",
            border: "1px solid #2563eb",
          }}
          title={`Bluetooth: ${bleDeviceName} (click to disconnect)`}
          aria-label="Disconnect Bluetooth MIDI"
        >
          <Bluetooth size={12} />
          {bleDeviceName}
        </button>
      ) : (
        <button
          onClick={connectBluetooth}
          disabled={bleStatus === "scanning" || bleStatus === "connecting"}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer"
          style={{
            background: "var(--color-surface-alt)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            opacity:
              bleStatus === "scanning" || bleStatus === "connecting" ? 0.6 : 1,
          }}
          title="Connect Bluetooth MIDI device (e.g. Roland piano)"
          aria-label="Connect Bluetooth MIDI"
        >
          <Bluetooth size={12} />
          {bleStatus === "scanning"
            ? "Scanning..."
            : bleStatus === "connecting"
              ? "Connecting..."
              : "Bluetooth"}
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
