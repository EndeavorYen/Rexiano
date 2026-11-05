import { useCallback, useState } from "react";
import { Bluetooth, Copy, Piano, Settings2 } from "lucide-react";
import { useMidiDeviceStore } from "@renderer/stores/useMidiDeviceStore";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { MIDI_CONNECTION_ERROR } from "./midiConnectionErrors";
import { getMidiErrorGuidance } from "./midiErrorGuidance";
import { getBluetoothConnectedLabel } from "./bluetoothDeviceDisplay";
import {
  BLUEFY_APP_STORE_URL,
  currentPianoBrowserSupport,
  type PianoBrowserSupport,
} from "./pianoBrowserSupport";

interface DeviceSelectorProps {
  onBeforeBluetoothConnect?: () => void;
}

const WEB_MIDI_ERRORS = new Set<string>(
  Object.values(MIDI_CONNECTION_ERROR).filter(
    (code) => code !== MIDI_CONNECTION_ERROR.bluetoothUnsupported,
  ),
);

/**
 * Piano connection, Bluetooth first: Rexiano supports Bluetooth (BLE-MIDI)
 * pianos. One button pairs the piano for both directions — the learner's
 * keys come in, the song goes out. Web MIDI ports (a piano the OS already
 * paired) live under "Other ways to connect".
 */
export function DeviceSelector({
  onBeforeBluetoothConnect,
}: DeviceSelectorProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const bleStatus = useMidiDeviceStore((s) => s.bleStatus);
  const bleDeviceName = useMidiDeviceStore((s) => s.bleDeviceName);
  const connectionError = useMidiDeviceStore((s) => s.connectionError);
  const connectBluetooth = useMidiDeviceStore((s) => s.connectBluetooth);
  const disconnectBluetooth = useMidiDeviceStore((s) => s.disconnectBluetooth);
  const [support] = useState<PianoBrowserSupport>(currentPianoBrowserSupport);

  const busy = bleStatus === "scanning" || bleStatus === "connecting";
  const connectedLabel = getBluetoothConnectedLabel(
    bleStatus === "connected",
    bleDeviceName,
    t("midi.bleConnectedDevice"),
  );

  const handleBluetoothConnect = useCallback((): void => {
    onBeforeBluetoothConnect?.();
    window.requestAnimationFrame(() => {
      void connectBluetooth();
    });
  }, [connectBluetooth, onBeforeBluetoothConnect]);

  const bleError =
    bleStatus === "error" &&
    connectionError &&
    !WEB_MIDI_ERRORS.has(connectionError)
      ? connectionError
      : null;

  return (
    <div
      className="flex flex-col gap-3 font-body"
      style={{ color: "var(--color-text)" }}
      data-testid="piano-connection"
    >
      <div
        className="set-card"
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
          style={{
            background: connectedLabel
              ? "color-mix(in srgb, var(--color-success-text) 16%, var(--color-surface))"
              : "var(--color-surface-alt)",
            color: connectedLabel
              ? "var(--color-success-text)"
              : "var(--color-text-muted)",
          }}
          aria-hidden="true"
        >
          <Piano size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 font-bold" data-testid="piano-connection-status">
            {connectedLabel
              ? t("piano.connectedTo", { name: connectedLabel })
              : busy
                ? bleStatus === "scanning"
                  ? t("midi.bleScanning")
                  : t("midi.bleConnecting")
                : t("piano.notConnected")}
          </p>
          <p
            className="m-0 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            {connectedLabel ? t("piano.connectedHint") : t("piano.connectHint")}
          </p>
        </div>
        {connectedLabel ? (
          <button
            onClick={disconnectBluetooth}
            className="btn-ghost-themed min-h-11 shrink-0 rounded-2xl px-4 text-sm font-bold cursor-pointer"
            aria-label={t("midi.bleDisconnect")}
            title={t("midi.bleDeviceTitle", { name: connectedLabel })}
          >
            {t("midi.disconnect")}
          </button>
        ) : (
          support === "ok" && (
            <button
              onClick={handleBluetoothConnect}
              disabled={busy}
              className="btn-primary-themed flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm cursor-pointer"
              aria-label={t("midi.bluetooth")}
              title={t("midi.bleConnect")}
              data-testid="piano-connect-bluetooth"
            >
              <Bluetooth size={16} />
              {t("piano.connect")}
            </button>
          )
        )}
      </div>

      {support !== "ok" && <BrowserGuide support={support} />}

      {bleError && (
        <ErrorCard code={bleError} onRetry={handleBluetoothConnect} />
      )}

      <SoundSourceCard />

      {support === "ok" || support === "mac-safari" ? (
        <OtherConnections />
      ) : null}
    </div>
  );
}

function BrowserGuide({
  support,
}: {
  support: Exclude<PianoBrowserSupport, "ok">;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback((): void => {
    void navigator.clipboard
      ?.writeText(window.location.origin)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  }, []);

  if (support === "ios") {
    return (
      <div className="set-card" data-testid="piano-browser-guide-ios">
        <h3>{t("piano.iosTitle")}</h3>
        <p className="hint">{t("piano.iosBody")}</p>
        <ol className="m-0 flex flex-col gap-1 pl-5 text-sm">
          <li>{t("piano.iosStep1")}</li>
          <li>{t("piano.iosStep2")}</li>
          <li>{t("piano.iosStep3")}</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <a
            href={BLUEFY_APP_STORE_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-primary-themed inline-flex min-h-11 items-center rounded-2xl px-4 text-sm no-underline"
          >
            {t("piano.getBluefy")}
          </a>
          <button
            onClick={copyAddress}
            className="btn-surface-themed inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-bold cursor-pointer"
          >
            <Copy size={15} />
            {copied ? t("piano.copied") : t("piano.copyAddress")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="set-card" data-testid="piano-browser-guide">
      <h3>{t("piano.browserTitle")}</h3>
      <p className="hint">
        {support === "mac-safari"
          ? t("piano.macSafariBody")
          : t("piano.otherBrowserBody")}
      </p>
    </div>
  );
}

function ErrorCard({
  code,
  onRetry,
}: {
  code: string;
  onRetry?: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const guidance = getMidiErrorGuidance(code, t);
  return (
    <div
      className="set-card"
      style={{ borderColor: "var(--color-danger-text)" }}
      role="alert"
      data-testid="midi-error-guidance"
    >
      <h3 style={{ color: "var(--color-danger-text)" }}>{guidance.title}</h3>
      <p className="hint">{guidance.guidance}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-surface-themed self-start min-h-10 rounded-xl px-3 text-sm font-bold cursor-pointer"
          data-recovery-action="connect-bluetooth-midi"
        >
          {t("piano.tryAgain")}
        </button>
      )}
    </div>
  );
}

/** Where the song sounds: on the piano, or on this device's speakers. */
export function SoundSourceCard(): React.JSX.Element {
  const { t } = useTranslation();
  const soundSource = useSettingsStore((s) => s.soundSource);
  const setSoundSource = useSettingsStore((s) => s.setSoundSource);
  const pianoAvailable = useMidiDeviceStore((s) => s.pianoOutputAvailable);

  return (
    <div className="set-card" data-testid="sound-source">
      <h3>{t("piano.soundSource")}</h3>
      <div
        className="segmented"
        role="group"
        aria-label={t("piano.soundSource")}
      >
        <button
          aria-pressed={soundSource === "piano"}
          onClick={() => setSoundSource("piano")}
          data-testid="sound-source-piano"
        >
          {t("piano.soundPiano")}
        </button>
        <button
          aria-pressed={soundSource === "computer"}
          onClick={() => setSoundSource("computer")}
          data-testid="sound-source-computer"
        >
          {t("piano.soundComputer")}
        </button>
      </div>
      <p className="hint">
        {soundSource === "piano"
          ? pianoAvailable
            ? t("piano.soundPianoHint")
            : t("piano.soundPianoWaiting")
          : t("piano.soundComputerHint")}
      </p>
    </div>
  );
}

/**
 * A piano already paired by the operating system (macOS Audio MIDI Setup,
 * a Windows BLE bridge) shows up as an ordinary Web MIDI port. Web MIDI is
 * only touched once this section is opened, so nobody gets a permission
 * prompt just for looking at the drawer.
 */
function OtherConnections(): React.JSX.Element {
  const { t } = useTranslation();
  const inputs = useMidiDeviceStore((s) => s.inputs);
  const outputs = useMidiDeviceStore((s) => s.outputs);
  const selectedInputId = useMidiDeviceStore((s) => s.selectedInputId);
  const selectedOutputId = useMidiDeviceStore((s) => s.selectedOutputId);
  const connectionError = useMidiDeviceStore((s) => s.connectionError);
  const connect = useMidiDeviceStore((s) => s.connect);
  const selectInput = useMidiDeviceStore((s) => s.selectInput);
  const selectOutput = useMidiDeviceStore((s) => s.selectOutput);
  const [opened, setOpened] = useState(false);

  const connectedInputs = inputs.filter((d) => d.state === "connected");
  const connectedOutputs = outputs.filter((d) => d.state === "connected");
  const webMidiError =
    opened && connectionError && WEB_MIDI_ERRORS.has(connectionError)
      ? connectionError
      : null;

  return (
    <details
      className="set-card"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open && !opened) {
          setOpened(true);
          void connect();
        }
      }}
      data-testid="piano-other-connections"
    >
      <summary className="flex cursor-pointer items-center gap-2 font-bold">
        <Settings2 size={16} />
        {t("piano.otherConnections")}
      </summary>
      <p className="hint">{t("piano.otherConnectionsHint")}</p>
      {webMidiError ? (
        <ErrorCard code={webMidiError} />
      ) : connectedInputs.length === 0 && connectedOutputs.length === 0 ? (
        <p className="hint">{t("midi.noDevices")}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--color-text-muted)" }}>
              {t("midi.inputLabel")}
            </span>
            <select
              value={selectedInputId ?? ""}
              onChange={(e) => selectInput(e.target.value || null)}
              className="select-themed min-h-10 rounded-xl px-2"
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
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--color-text-muted)" }}>
              {t("midi.outputLabel")}
            </span>
            <select
              value={selectedOutputId ?? ""}
              onChange={(e) => selectOutput(e.target.value || null)}
              className="select-themed min-h-10 rounded-xl px-2"
              aria-label={t("midi.outputDevice")}
            >
              <option value="">{t("midi.noneOption")}</option>
              {connectedOutputs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </details>
  );
}
