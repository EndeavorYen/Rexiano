import { useId, useLayoutEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import type {
  FileImportErrorGuidance,
  FileImportErrorInput,
  FileImportRecoveryActionId,
} from "./fileImportErrorGuidance";
import { shouldRestoreImportAlertFocus } from "./fileImportAlertFocus";

interface FileImportErrorAlertProps {
  input: FileImportErrorInput;
  guidance: FileImportErrorGuidance;
  onAction: (
    actionId: FileImportRecoveryActionId,
    input: FileImportErrorInput,
  ) => void;
  onDismiss: () => void;
}

export function FileImportErrorAlert({
  input,
  guidance,
  onAction,
  onDismiss,
}: FileImportErrorAlertProps): React.JSX.Element {
  const { t } = useTranslation();
  const alertRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      activeElement !== document.body &&
      activeElement !== document.documentElement &&
      !alertRef.current?.contains(activeElement)
    ) {
      returnFocusRef.current = activeElement;
    }

    const alertElement = alertRef.current;
    return () => {
      const target = returnFocusRef.current;
      const alertHadFocus = Boolean(
        alertElement?.contains(document.activeElement),
      );
      window.setTimeout(() => {
        if (
          target &&
          shouldRestoreImportAlertFocus({
            alertHadFocus,
            returnTargetIsConnected: target.isConnected,
          })
        ) {
          target.focus({ preventScroll: true });
        }
      }, 0);
    };
  }, []);

  return (
    <div
      ref={alertRef}
      className="fixed left-1/2 top-4 z-[250] w-[min(92vw,440px)] -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-body subtle-shadow-md"
      style={{
        color: "var(--color-text)",
        background: "var(--color-surface)",
        border:
          "1px solid color-mix(in srgb, var(--color-hit-line) 70%, var(--color-border))",
      }}
      title={guidance.diagnostic || undefined}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="file-import-error-toast"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 shrink-0"
          size={18}
          aria-hidden="true"
          style={{ color: "var(--color-hit-line)" }}
        />
        <div className="min-w-0 flex-1">
          <div id={titleId} className="font-semibold">
            {guidance.title}
          </div>
          <div
            id={descriptionId}
            className="mt-0.5 text-xs leading-snug"
            style={{ color: "var(--color-text-muted)" }}
          >
            {guidance.guidance}
          </div>
        </div>
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t("app.importRecoveryActionsLabel")}
      >
        {guidance.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id, input)}
            className={`${
              action.emphasis === "primary"
                ? "btn-primary-themed"
                : "btn-surface-themed"
            } min-h-9 rounded-lg px-3 py-1.5 text-xs font-body font-semibold cursor-pointer`}
            data-import-recovery-action={action.id}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onDismiss}
          className="btn-surface-themed ml-auto flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-body font-semibold cursor-pointer"
        >
          <X size={13} aria-hidden="true" />
          {t("general.close")}
        </button>
      </div>
    </div>
  );
}
