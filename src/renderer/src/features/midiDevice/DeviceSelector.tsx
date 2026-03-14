import {
  useEffect,
  useCallback,
  useState,
  useRef,
  startTransition,
} from "react";
import { Bluetooth } from "lucide-react";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { ConnectionStatus } from "./ConnectionStatus";
import type { TestButtonState } from "./midiTestUtils";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { spellNote } from "@renderer/utils/enharmonicSpelling";

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
  const storeSendTestNote = useMidiDeviceStore((s) => s.sendTestNote);
  const connectBluetooth = useMidiDeviceStore((s) => s.connectBluetooth);
  const disconnectBluetooth = useMidiDeviceStore((s) => s.disconnectBluetooth);

  // Test button state
  const [testState, setTestState] = useState<TestButtonState>("idle");
  const okTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // MIDI input test state
  const lastNoteOn = useMidiDeviceStore((s) => s.lastNoteOn);
  const [testNote, setTestNote] = useState<{
    name: string;
    velocity: number;
  } | null>(null);
  const lastNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update test note display when a new note is received
  useEffect(() => {
    if (!lastNoteOn || !isConnected) return;
    if (lastNoteTimerRef.current) clearTimeout(lastNoteTimerRef.current);
    startTransition(() => {
      setTestNote({
        name: spellNote(lastNoteOn.midi),
        velocity: lastNoteOn.velocity,
      });
    });
    lastNoteTimerRef.current = setTimeout(() => {
      startTransition(() => setTestNote(null));
      lastNoteTimerRef.current = null;
    }, 3000);
  }, [lastNoteOn, isConnected]);

  // Auto-init MIDI access on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (okTimerRef.current) clearTimeout(okTimerRef.current);
      if (lastNoteTimerRef.current) clearTimeout(lastNoteTimerRef.current);
    };
  }, []);

  const handleTestClick = useCallback(async () => {
    if (testState !== "idle") return;

    setTestState("playing");
    try {
      await storeSendTestNote();
      setTestState("ok");
      okTimerRef.current = setTimeout(() => {
        setTestState("idle");
        okTimerRef.current = null;
      }, 1500);
    } catch {
      setTestState("idle");
    }
  }, [testState, storeSendTestNote]);

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
                  testState === "ok"
                    ? "var(--color-hit-glow)"
                    : "var(--color-surface)",
                color:
                  testState === "ok" ? "var(--color-bg)" : "var(--color-text)",
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

      {/* MIDI input test display — visible when an input device is connected */}
      {isConnected && selectedInputId && (
        <div
          className="flex items-center gap-1.5 rounded-lg px-2 py-1"
          style={{
            background:
              "color-mix(in srgb, var(--color-surface) 75%, transparent)",
            border: `1px solid ${testNote ? "var(--color-accent)" : "var(--color-border)"}`,
            transition: "border-color 0.2s",
          }}
          data-testid="midi-input-test"
        >
          <span
            className="text-[10px] font-body"
            style={{ color: "var(--color-text-muted)" }}
          >
            {t("midi.testKeyboard")}
          </span>
          {testNote ? (
            <span
              className="text-xs font-mono font-semibold tabular-nums"
              style={{ color: "var(--color-accent)" }}
              data-testid="midi-test-note"
            >
              {testNote.name}
              <span
                className="text-[10px] font-normal ml-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                v{testNote.velocity}
              </span>
            </span>
          ) : (
            <span
              className="text-[10px] italic"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("midi.pressAKey")}
            </span>
          )}
        </div>
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
        <div
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 max-w-[min(360px,calc(100vw-2rem))]"
          style={{
            color: "var(--color-error)",
            background:
              "color-mix(in srgb, var(--color-error) 8%, var(--color-surface))",
            border:
              "1px solid color-mix(in srgb, var(--color-error) 30%, var(--color-border))",
          }}
          data-testid="midi-error-guidance"
        >
          <span className="text-xs truncate" title={connectionError}>
            {connectionError}
          </span>
          <button
            onClick={() => connect()}
            className="px-1.5 py-0.5 rounded text-[10px] font-body font-medium cursor-pointer"
            style={{
              color: "var(--color-text)",
              background:
                "color-mix(in srgb, var(--color-surface-alt) 75%, var(--color-surface))",
              border: "1px solid var(--color-border)",
            }}
          >
            {t("audio.retry")}
          </button>
          {bleStatus !== "connected" && (
            <button
              onClick={() => connectBluetooth()}
              disabled={bleStatus === "scanning" || bleStatus === "connecting"}
              className="px-1.5 py-0.5 rounded text-[10px] font-body font-medium cursor-pointer disabled:opacity-55"
              style={{
                color: "var(--color-text)",
                background:
                  "color-mix(in srgb, var(--color-surface-alt) 75%, var(--color-surface))",
                border: "1px solid var(--color-border)",
              }}
            >
              {t("midi.bluetooth")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
