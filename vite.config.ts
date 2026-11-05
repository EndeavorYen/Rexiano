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
        background_color: "#EAF1F8",
        theme_color: "#EAF1F8",
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
        // Chinese font subsets are large; cache the ones actually used instead.
        globIgnores: ["scores/**", "**/noto-sans-tc-*"],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/noto-sans-tc-.*\.woff2?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "rexiano-fonts",
              expiration: { maxEntries: 400 },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        navigateFallback: "/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
