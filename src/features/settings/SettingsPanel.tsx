import { useCallback, useRef, useState } from "react";
import { X } from "lucide-react";
import { useSettingsStore } from "@renderer/stores/useSettingsStore";
import { useThemeStore } from "@renderer/stores/useThemeStore";
import type { ThemePreference } from "@renderer/themes/tokens";
import { rangeProgressStyle } from "@renderer/utils/rangeProgress";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type { TranslationKey } from "@renderer/i18n/types";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { DeviceSelector } from "../midiDevice/DeviceSelector";
import {
  applyUserDataBackupToRuntime,
  createUserDataBackupFromRuntime,
  parseUserDataBackupText,
} from "./userDataBackup";
import {
  downloadBytes,
  pickFileWithInput,
} from "@renderer/platform/installWebPlatform";

/**
 * Settings, the colormon / sudomon way: one scrolling column of cards.
 * Appearance, language, sound, piano and backup — nothing else lives here.
 */

const THEME_OPTIONS: { id: ThemePreference; key: TranslationKey }[] = [
  { id: "system", key: "settings.themeSystem" },
  { id: "light", key: "settings.themeLight" },
  { id: "dark", key: "settings.themeDark" },
];

function AppearanceCard(): React.JSX.Element {
  const { t } = useTranslation();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return (
    <section className="set-card" data-testid="settings-appearance">
      <h3>{t("settings.theme")}</h3>
      <div className="segmented" role="group" aria-label={t("settings.theme")}>
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.id}
            aria-pressed={preference === option.id}
            onClick={() => setPreference(option.id)}
            data-testid={`theme-${option.id}`}
          >
            {t(option.key)}
          </button>
        ))}
      </div>
    </section>
  );
}

function LanguageCard(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="set-card" data-testid="settings-language">
      <h3>{t("settings.language")}</h3>
      <LanguageSwitcher />
    </section>
  );
}

function SoundCard(): React.JSX.Element {
  const { t } = useTranslation();
  const volume = useSettingsStore((s) => s.volume);
  const muted = useSettingsStore((s) => s.muted);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const setMuted = useSettingsStore((s) => s.setMuted);

  return (
    <section className="set-card" data-testid="settings-sound">
      <h3>{t("settings.audioSettings")}</h3>
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-sm">
          <span>{t("settings.volume")}</span>
          <span
            className="tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            {muted ? t("settings.muted") : volume}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-full"
          style={rangeProgressStyle(muted ? 0 : volume, 0, 100)}
          disabled={muted}
          aria-label={t("settings.volume")}
          data-testid="volume-slider"
        />
      </label>
      <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          checked={muted}
          onChange={() => setMuted(!muted)}
          className="h-5 w-5 shrink-0"
          style={{ accentColor: "var(--color-success-text)" }}
          data-testid="toggle-mute"
        />
        <span>{t("settings.muteAudio")}</span>
      </label>
    </section>
  );
}

function PianoLatencyCard(): React.JSX.Element {
  const { t } = useTranslation();
  const latency = useSettingsStore((s) => s.pianoOutputLatency);
  const setLatency = useSettingsStore((s) => s.setPianoOutputLatency);
  return (
    <section className="set-card" data-testid="settings-piano-latency">
      <h3>{t("piano.outputLatency")}</h3>
      <p className="hint">{t("piano.outputLatencyHint")}</p>
      <label className="flex flex-col gap-1.5">
        <span className="flex justify-end text-sm tabular-nums">
          {t("piano.outputLatencyValue", { ms: latency })}
        </span>
        <input
          type="range"
          min={0}
          max={150}
          step={5}
          value={latency}
          onChange={(e) => setLatency(Number(e.target.value))}
          style={rangeProgressStyle(latency, 0, 150)}
          aria-label={t("piano.outputLatency")}
          data-testid="piano-latency-slider"
        />
      </label>
    </section>
  );
}

function BackupCard(): React.JSX.Element {
  const { t } = useTranslation();
  const [message, setMessage] = useState<{
    text: string;
    ok: boolean;
    reload?: boolean;
  } | null>(null);

  const exportBackup = useCallback(async () => {
    const result = await createUserDataBackupFromRuntime(
      localStorage,
      window.api,
    );
    if (!result.ok) {
      setMessage({
        text: result.errors[0] ?? t("settings.backupUnknownError"),
        ok: false,
      });
      return;
    }
    const day = new Date().toISOString().slice(0, 10);
    downloadBytes(
      `rexiano-backup-${day}.json`,
      new TextEncoder().encode(JSON.stringify(result.manifest, null, 2)),
      "application/json",
    );
    setMessage({
      text: t("settings.backupExportSuccess", {
        count: result.manifest.scopes.length,
      }),
      ok: true,
    });
  }, [t]);

  const importBackup = useCallback(async () => {
    const file = await pickFileWithInput(".json,application/json");
    if (!file) return;
    const parsed = parseUserDataBackupText(await file.text());
    if (!parsed.ok) {
      setMessage({
        text: parsed.errors[0] ?? t("settings.backupUnknownError"),
        ok: false,
      });
      return;
    }
    const applied = await applyUserDataBackupToRuntime(
      parsed.manifest,
      localStorage,
      window.api,
    );
    if (!applied.ok) {
      setMessage({
        text: applied.errors[0] ?? t("settings.backupUnknownError"),
        ok: false,
      });
      return;
    }
    setMessage({
      text: t("settings.backupImportSuccess", {
        count: applied.appliedScopes.length,
      }),
      ok: true,
      reload: true,
    });
  }, [t]);

  return (
    <section className="set-card" data-testid="settings-backup">
      <h3>{t("settings.backupTitle")}</h3>
      <p className="hint">{t("settings.backupBrowserDesc")}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => void exportBackup()}
          className="btn-surface-themed min-h-11 rounded-2xl px-3 text-sm font-bold cursor-pointer"
          data-testid="user-data-export"
        >
          {t("settings.backupExport")}
        </button>
        <button
          onClick={() => void importBackup()}
          className="btn-surface-themed min-h-11 rounded-2xl px-3 text-sm font-bold cursor-pointer"
          data-testid="user-data-import"
        >
          {t("settings.backupImport")}
        </button>
      </div>
      {message && (
        <p
          className="m-0 flex flex-wrap items-center gap-2 text-sm"
          role="status"
          style={{
            color: message.ok
              ? "var(--color-success-text)"
              : "var(--color-danger-text)",
          }}
        >
          {message.text}
          {message.reload && (
            <button
              onClick={() => window.location.reload()}
              className="btn-primary-themed min-h-9 rounded-xl px-3 text-sm cursor-pointer"
            >
              {t("settings.reloadNow")}
            </button>
          )}
        </p>
      )}
    </section>
  );
}

/**
 * Sound and language cards, for surfaces that already are a panel
 * (the playback drawer).
 */
export function SettingsSections(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3" data-testid="settings-sections">
      <SoundCard />
      <LanguageCard />
    </div>
  );
}

interface SettingsPanelProps {
  /** Called when the dialog is closed */
  onClose?: () => void;
}

/** The settings sheet opened from the gear in the top bar. */
export function SettingsPanel({
  onClose,
}: SettingsPanelProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useDialogFocus({
    active: true,
    containerRef: panelRef,
    initialFocusRef: closeButtonRef,
    onDismiss: handleClose,
  });

  return (
    <div
      className="family-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={panelRef}
        className="family-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        tabIndex={-1}
        data-testid="settings-panel"
      >
        <div className="family-sheet-head">
          <h2>{t("settings.title")}</h2>
          <button
            ref={closeButtonRef}
            onClick={handleClose}
            className="icon-btn"
            title={t("settings.close")}
            aria-label={t("settings.close")}
            data-testid="settings-close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="family-sheet-body">
          <AppearanceCard />
          <LanguageCard />
          <SoundCard />
          <section className="flex flex-col gap-2" data-testid="settings-piano">
            <h3
              className="m-0 px-1 text-sm font-bold"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("piano.title")}
            </h3>
            <DeviceSelector />
          </section>
          <PianoLatencyCard />
          <BackupCard />
        </div>
      </div>
    </div>
  );
}
