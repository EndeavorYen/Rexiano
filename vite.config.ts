import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      "@renderer": resolve(__dirname, "src"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["icons/favicon-32.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Rexiano",
        short_name: "Rexiano",
        description:
          "Free piano practice with falling notes, sheet music, and MIDI keyboards.",
        lang: "zh-TW",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "landscape",
        background_color: "#fffaf0",
        theme_color: "#1e2327",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        // Installed PWAs on desktop Chrome/Edge can open .mid files directly.
        file_handlers: [
          {
            action: "/",
            accept: {
              "audio/midi": [".mid", ".midi", ".kar"],
              "application/vnd.recordare.musicxml+xml": [".musicxml", ".xml"],
            },
          },
        ],
      },
      workbox: {
        // The SoundFont and built-in songs are what make practice work offline.
        globPatterns: [
          "**/*.{js,css,html,woff,woff2,png,svg,sf2,mid}",
          "midi/songs.json",
        ],
        globIgnores: ["scores/**"],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
