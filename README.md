<p align="center">
  <img src="docs/figure/Rexiano_icon.png" alt="Rexiano" width="88">
</p>

<h1 align="center">Rexiano</h1>

<p align="center">
  Free piano practice in your browser — falling notes, sheet music, and MIDI. Install it as an app to practice offline.<br>
  Built by a dad for Rex, and shared with anyone learning piano.
</p>

<p align="center">
  <a href="README-zh.md">繁體中文</a> · <strong>English</strong>
</p>

<p align="center">
  Unlike <strong>Synthesia</strong>, Rexiano is free, open source, and runs right in the browser, with Watch and Wait practice modes.
</p>

<p align="center">
  <strong>Open Rexiano in your browser</strong><br>
  <sub>Computers and tablets · MIDI keyboards in Chrome / Edge · Installable as a PWA for offline use</sub>
</p>

<p align="center">
  <img src="docs/assets/marketing/piano-sheet-hero.png" alt="A piano and open sheet music by a window — Rexiano atmosphere, not a product screenshot" width="100%">
</p>

<p align="center"><sub>Atmosphere photo — not the app. Real screenshots are just below.</sub></p>

<table>
  <tr>
    <td width="33%" align="center">
      <img src="docs/assets/screenshots/rexiano-library.png" alt="Rexiano song library with built-in songs" width="100%"><br>
      <sub>Song Library: built-in songs, filters, favorites, and recent files.</sub>
    </td>
    <td width="33%" align="center">
      <img src="docs/assets/screenshots/rexiano-practice.png" alt="Rexiano falling notes practice view" width="100%"><br>
      <sub>Practice View: falling notes, keyboard feedback, scoring, and speed control.</sub>
    </td>
    <td width="33%" align="center">
      <img src="docs/assets/screenshots/rexiano-split-sheet.png" alt="Rexiano split sheet music and falling notes view" width="100%"><br>
      <sub>Split Sheet: notation and falling notes stay in sync.</sub>
    </td>
  </tr>
</table>

## Start Practicing

1. Open the Rexiano web app (hosted on Vercel) in Chrome or Edge.
2. Choose a built-in song, or drag in your own `.mid` / `.midi` / `.musicxml` file. Imported files stay in this browser, so you can reopen them from Recent or the library.
3. Start with **Watch** mode, then switch to **Wait** mode when you want Rexiano to pause until you play the right notes.
4. Connect a USB or Bluetooth MIDI keyboard when you want live key feedback and scoring.

No keyboard is required for listening and visual study. Wait mode and scored practice need MIDI input.

To practice offline, click **Install** in the Chrome / Edge address bar. Rexiano becomes a standalone app with the built-in songs and piano sound downloaded ahead of time, and it can open `.mid` files directly.

## Browser Support

| Device                  | Practice & playback | MIDI keyboard                        |
| ----------------------- | ------------------- | ------------------------------------ |
| Windows / macOS / Linux | ✅                  | Chrome, Edge (USB and Bluetooth)     |
| Android tablet          | ✅                  | Chrome (USB and Bluetooth)           |
| iPad                    | ✅                  | Safari has no Web MIDI — see below   |
| Phone                   | Not supported       | Layout targets computers and tablets |

**MIDI on iPad**: every iPadOS browser, Chrome included, runs on Safari's engine, which has no Web MIDI. Install a browser app with Web MIDI built in from the App Store (for example "Web MIDI Browser") and open the Rexiano address there.

Practice history lives in the browser. Export it from **User Data Backup** in Settings before switching browsers or clearing site data. Backups from the 1.6.0 desktop app import here too.

## Highlights

| Area            | What Rexiano Helps With                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Visual learning | 60 FPS falling notes, 88-key highlighting, note labels, and per-track colors for left/right hand separation.     |
| Sheet music     | Split, sheet-only, and falling-notes display modes for switching between notation and piano-roll practice.       |
| Practice focus  | Watch, Wait, and Free modes, plus speed control, split-hand practice, metronome, count-in, and progress history. |
| MIDI keyboards  | USB and Bluetooth MIDI input/output, hot-plug detection, auto-reconnect, and sustain pedal support.              |
| Sound           | Bundled FreePats Upright Piano KW SoundFont with Web Audio playback and a synthesizer fallback.                  |
| Files           | Built-in song library plus drag-and-drop import for your own MIDI files.                                         |

## Bluetooth MIDI

In Chrome / Edge, the **Bluetooth** button in the MIDI drawer opens the browser's own pairing dialog. A keyboard already paired with the system that shows up as a normal MIDI port can be picked directly:

| Platform | Setup                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| macOS    | Pair in Audio MIDI Setup; the keyboard then appears as a normal MIDI device.                               |
| Windows  | Try Rexiano's Bluetooth button first. If that fails, bridge it with MIDIberry or the KORG BLE-MIDI Driver. |
| Android  | Pair with Rexiano's Bluetooth button.                                                                      |

Detailed steps live in [User Guide -- Connecting a MIDI Keyboard](docs/user-guide-en.md#5-connecting-a-midi-keyboard).

## Develop

Prerequisites: [Node.js](https://nodejs.org/) `>=22 <23`, [pnpm](https://pnpm.io/) `>=10 <11`, and Git.

```bash
git clone https://github.com/EndeavorYen/Rexiano.git
cd Rexiano
pnpm install
pnpm dev
```

Common commands:

| Command            | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `pnpm dev`         | Start the Vite dev server with HMR.          |
| `pnpm build`       | Typecheck and build to `dist/` (with PWA).   |
| `pnpm lint`        | Run ESLint.                                  |
| `pnpm typecheck`   | Run TypeScript checks.                       |
| `pnpm test`        | Run Vitest unit tests.                       |
| `pnpm test:e2e`    | Build and run Playwright E2E in Chromium.    |
| `pnpm test:visual` | Build and run focused UI visual guard tests. |

Before opening a PR, run:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

To refresh README screenshots:

```bash
pnpm exec playwright test -c scripts/playwright.readme-screenshots.config.ts
```

## Deploy

Import the repo in Vercel; `vercel.json` already sets Vite, pnpm, and the `dist/` output. Pushes to `main` deploy automatically and pull requests get preview URLs.

## Project Map

```text
src/
  platform/              Web platform: static assets, IndexedDB, file picker and downloads (window.api)
  engines/               Pure logic: audio, falling notes, MIDI, practice
  stores/                Zustand state
  features/              React UI
  themes/                CSS custom property tokens
  shared/                Types and shared validation
public/                  SoundFont, built-in MIDI songs, PWA icons
site/                    GitHub Pages landing site
```

## Tech Stack

| Layer     | Technology                                            |
| --------- | ----------------------------------------------------- |
| Build     | Vite 7, vite-plugin-pwa (Workbox)                     |
| UI        | React 19, TypeScript 5.9, Tailwind CSS 4              |
| Rendering | PixiJS 8 for falling notes, VexFlow 5 for sheet music |
| State     | Zustand 5                                             |
| MIDI      | Web MIDI API, Web Bluetooth, `@tonejs/midi`           |
| Audio     | Web Audio API, `soundfont2`                           |
| Storage   | IndexedDB, localStorage                               |
| Testing   | Vitest 4, Playwright                                  |
| Hosting   | Vercel                                                |

## Documentation

| Goal                        | English                                                                  | 繁體中文                                                        |
| --------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Start using Rexiano         | [User Guide](docs/user-guide-en.md)                                      | [使用手冊](docs/user-guide.md)                                  |
| Understand the architecture | [Architecture](docs/architecture.md), [System Design](docs/DESIGN-en.md) | [架構文件](docs/architecture-zh.md), [系統設計](docs/DESIGN.md) |
| Track project work          | [Roadmap](docs/ROADMAP.md)                                               | [開發路線圖](docs/ROADMAP.md)                                   |

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md), the [Architecture doc](docs/architecture.md), and the [System Design doc](docs/DESIGN-en.md) before changing code.

Keep changes small, testable, and aligned with the existing engine/store/feature boundaries.

## License

Rexiano is licensed under the [GNU General Public License v3.0](LICENSE). You may use, modify, and distribute it under GPL-3.0 terms; distributed modifications must make source code available under the same license.

## Acknowledgments

- Built with love for Rex, who is learning to play piano.
- Thank you to the open-source projects that make Rexiano possible.
