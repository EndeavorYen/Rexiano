import "./assets/main.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "./i18n/I18nProvider";
import { installWebPlatform } from "./platform/installWebPlatform";

async function startApp(): Promise<void> {
  installWebPlatform();

  if (import.meta.env.PROD && !import.meta.env.VITE_REXIANO_E2E) {
    // Offline support: precaches the app, SoundFont and built-in songs.
    const { registerSW } = await import("virtual:pwa-register");
    registerSW({ immediate: true });
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

void startApp();
