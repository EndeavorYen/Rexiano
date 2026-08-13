import "./assets/main.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "./i18n/I18nProvider";
import { recoverPendingUserDataBackupRuntime } from "./features/settings/userDataBackup";

async function startRenderer(): Promise<void> {
  const recovery = await recoverPendingUserDataBackupRuntime(
    localStorage,
    window.api,
  );
  if (!recovery.ok) {
    console.error(
      "User-data transaction recovery is still pending:",
      recovery.errors,
    );
  }

  await import("./stores/useThemeStore");
  const { default: App } = await import("./App");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}

void startRenderer();
