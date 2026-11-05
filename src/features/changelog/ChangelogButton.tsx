import { useCallback, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { useTranslation } from "@renderer/i18n/useTranslation";
import { useDialogFocus } from "@renderer/hooks/useDialogFocus";
import {
  CHANGELOG_VERSIONS,
  LATEST_VERSION,
  hasUnseenVersion,
  isNewVersion,
  localizedVersion,
  markLatestSeen,
  readSeenVersion,
} from "./changelog";

/** ⓘ in the top bar; a red dot means there is a version not opened yet. */
export function ChangelogButton(): React.JSX.Element {
  const { t } = useTranslation();
  const [unseen, setUnseen] = useState(() => hasUnseenVersion());
  const [openedWithSeen, setOpenedWithSeen] = useState<
    string | null | undefined
  >(undefined);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const open = useCallback(() => {
    setOpenedWithSeen(readSeenVersion());
    markLatestSeen();
    setUnseen(false);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        className="icon-btn"
        onClick={open}
        aria-label={t("changelog.title")}
        title={t("changelog.title")}
        data-testid="changelog"
      >
        <Info size={20} />
        {unseen && <span className="dot" aria-hidden="true" />}
      </button>
      {openedWithSeen !== undefined && (
        <ChangelogSheet
          seen={openedWithSeen}
          returnFocusRef={triggerRef}
          onClose={() => setOpenedWithSeen(undefined)}
        />
      )}
    </>
  );
}

function ChangelogSheet({
  seen,
  returnFocusRef,
  onClose,
}: {
  seen: string | null;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}): React.JSX.Element {
  const { t, lang } = useTranslation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useDialogFocus({
    active: true,
    containerRef: sheetRef,
    initialFocusRef: closeRef,
    returnFocusRef,
    onDismiss: onClose,
  });

  return (
    <div
      className="family-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="family-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("changelog.title")}
        tabIndex={-1}
        data-testid="changelog-sheet"
      >
        <div className="family-sheet-head">
          <h2>{t("changelog.title")}</h2>
          <span
            className="text-sm tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            Rexiano v{LATEST_VERSION}
          </span>
          <button
            ref={closeRef}
            className="icon-btn"
            onClick={onClose}
            aria-label={t("settings.close")}
          >
            <X size={20} />
          </button>
        </div>
        <div className="family-sheet-body changelog">
          {CHANGELOG_VERSIONS.map((version, index) => {
            const text = localizedVersion(
              version,
              lang === "en" ? "en" : "zh-TW",
            );
            return (
              <article
                key={version.version}
                className={isNewVersion(index, seen) ? "new" : ""}
              >
                <h3>
                  <b>v{version.version}</b>
                  {text.title}
                  <small>{version.date}</small>
                </h3>
                <ul>
                  {text.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
