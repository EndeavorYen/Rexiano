import type { WebContents, WebPreferences } from "electron";
import { isTrustedRendererUrl } from "./ipc/midiPermissionPolicy";

export function createSecureRendererPreferences(
  preload: string,
): WebPreferences {
  return {
    preload,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
  };
}

/** Prevent the privileged renderer from becoming a browser for other origins. */
export function installRendererNavigationGuard(
  webContents: Pick<WebContents, "on">,
): void {
  const preventUntrustedNavigation = (
    event: { preventDefault(): void },
    url: string,
  ): void => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  };

  webContents.on("will-navigate", preventUntrustedNavigation);
  webContents.on("will-redirect", preventUntrustedNavigation);
}
