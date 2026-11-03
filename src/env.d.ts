/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "1" builds the Playwright fixture surface into the app */
  readonly VITE_REXIANO_E2E?: string;
}
