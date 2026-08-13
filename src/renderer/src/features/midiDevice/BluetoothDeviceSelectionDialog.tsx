import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bluetooth, X } from "lucide-react";
import type { BluetoothDeviceSelectionUpdate } from "@shared/types";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { buildBluetoothDeviceDisplayItems } from "./bluetoothDeviceDisplay";

export function BluetoothDeviceSelectionDialog(): React.JSX.Element | null {
  const { t } = useTranslation();
  const [update, setUpdate] = useState<BluetoothDeviceSelectionUpdate | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateRef = useRef<BluetoothDeviceSelectionUpdate | null>(null);
  const isSubmittingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      window.api.onBluetoothSelectionUpdate((nextUpdate) => {
        updateRef.current = nextUpdate;
        setUpdate(nextUpdate);
        if (!nextUpdate) {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        }
      }),
    [],
  );

  const displayItems = useMemo(
    () =>
      buildBluetoothDeviceDisplayItems(
        update?.devices ?? [],
        t("midi.blePickerUnnamed"),
      ),
    [t, update?.devices],
  );

  const cancel = useCallback((): void => {
    const currentUpdate = updateRef.current;
    if (!currentUpdate || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    void window.api
      .cancelBluetoothSelection({ requestId: currentUpdate.requestId })
      .then(
        (accepted) => {
          if (!accepted) {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
          }
        },
        () => {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        },
      );
  }, []);

  useDialogFocus({
    active: update !== null,
    containerRef: dialogRef,
    initialFocusRef: cancelRef,
    onDismiss: cancel,
  });

  if (!update) return null;

  const choose = (deviceId: string): void => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    void window.api
      .chooseBluetoothDevice({ requestId: update.requestId, deviceId })
      .then(
        (accepted) => {
          if (!accepted) {
            isSubmittingRef.current = false;
            setIsSubmitting(false);
          }
        },
        () => {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        },
      );
  };

  return (
    <div
      className="app-overlay-backdrop"
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={cancel}
      data-testid="bluetooth-device-backdrop"
    >
      <div
        ref={dialogRef}
        className="surface-panel subtle-shadow-md w-[min(92vw,460px)] rounded-3xl p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bluetooth-device-dialog-title"
        aria-describedby="bluetooth-device-dialog-description"
        tabIndex={-1}
        data-testid="bluetooth-device-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl btn-primary-themed">
              <Bluetooth size={19} aria-hidden="true" />
            </div>
            <h2
              id="bluetooth-device-dialog-title"
              className="font-display text-xl font-bold"
            >
              {t("midi.blePickerTitle")}
            </h2>
            <p
              id="bluetooth-device-dialog-description"
              className="mt-1 text-sm leading-relaxed"
              style={{ color: "var(--color-text-muted)" }}
            >
              {t("midi.blePickerDescription")}
            </p>
          </div>
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            disabled={isSubmitting}
            className="btn-surface-themed flex h-9 w-9 shrink-0 items-center justify-center rounded-full cursor-pointer disabled:opacity-55"
            aria-label={t("midi.blePickerCancel")}
          >
            <X size={15} />
          </button>
        </div>

        <div
          className="mt-4 text-xs font-semibold"
          style={{ color: "var(--color-text-muted)" }}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {displayItems.length === 0
            ? t("midi.blePickerScanning")
            : t("midi.blePickerCount", { count: displayItems.length })}
        </div>

        <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto pr-1">
          {displayItems.map((device) => (
            <button
              key={device.deviceId}
              type="button"
              onClick={() => choose(device.deviceId)}
              disabled={isSubmitting}
              className="btn-surface-themed flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-left font-body font-semibold cursor-pointer disabled:opacity-55"
              data-testid="bluetooth-device-option"
            >
              <Bluetooth size={16} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{device.label}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={cancel}
          disabled={isSubmitting}
          className="btn-surface-themed mt-4 min-h-10 w-full rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-55"
        >
          {t("midi.blePickerCancel")}
        </button>
      </div>
    </div>
  );
}
