import { createDefaultBrowserStore } from "./browserStore";
import { createWebApi } from "./webApi";
import type { RexianoApi } from "./types";

/** Open the native file picker; resolves null if the user cancels. */
export function pickFileWithInput(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    let settled = false;
    const finish = (file: File | null): void => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0] ?? null));
    input.addEventListener("cancel", () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

export function downloadBytes(
  fileName: string,
  data: Uint8Array,
  mimeType: string,
): void {
  const url = URL.createObjectURL(
    new Blob([data as Uint8Array<ArrayBuffer>], { type: mimeType }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function installWebPlatform(): RexianoApi {
  const api = createWebApi({
    store: createDefaultBrowserStore(),
    assetBase: import.meta.env.BASE_URL,
    fetch: (input, init) => fetch(input, init),
    now: () => Date.now(),
    pickFile: pickFileWithInput,
    download: downloadBytes,
    isE2eTestMode: import.meta.env.VITE_REXIANO_E2E === "1",
  });
  window.api = api;
  return api;
}
