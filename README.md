<img src="docs/figure/Rexiano_icon.png" alt="Rexiano icon" width="120" align="right">

# Rexiano

A free, open-source piano practice app with falling notes, MIDI keyboard support, and practice tools -- built by a dad for his son, shared with everyone.

[繁體中文](README-zh.md) | **English**

> **TL;DR** -- Rexiano runs offline on Windows, macOS, and Linux after install. Load a built-in or imported MIDI song, then practice with falling notes, sheet music, Wait mode, loops, scoring, and USB/Bluetooth MIDI keyboard feedback.

<p align="center">
  <img src="docs/assets/screenshots/rexiano-library.png" alt="Rexiano song library" width="32%">
  <img src="docs/assets/screenshots/rexiano-practice.png" alt="Rexiano falling-notes practice" width="32%">
  <img src="docs/assets/screenshots/rexiano-split-sheet.png" alt="Rexiano split sheet music and falling notes" width="32%">
</p>

---

## Features

**Visual Learning**

- Falling notes display (rhythm game style) rendered at 60 FPS via WebGL
- Sheet music view with split, sheet-only, and falling-notes display modes
- 88-key piano keyboard with real-time highlighting
- Note-name labels and fingering hints for beginner practice
- Per-track note coloring for left/right hand distinction

**Audio**

- Bundled FreePats Upright Piano KW SoundFont playback (Web Audio API)
- Volume control with master slider
- Synthesizer fallback when SoundFont is unavailable

**MIDI Connectivity**

- USB and Bluetooth MIDI keyboard input/output
- Hot-plug detection (connect/disconnect devices while running)
- Auto-reconnect to last used device
- Sustain pedal (CC64) support

**Practice Mode**

- **Watch Mode** -- sit back and observe the playback
- **Wait Mode** -- playback pauses until you play the correct notes
- **Free Mode** -- play along at your own pace
- Adjustable speed (0.25x to 2.0x)
- A-B loop for practicing difficult passages
- Split-hand practice (select which tracks to practice)
- Real-time scoring with accuracy and streak tracking
- Metronome, count-in, post-session next action, and progress history

**Themes**

- Four built-in themes: Lavender, Ocean, Peach, and Midnight (dark)
- All colors driven by CSS custom properties for full consistency

**File Handling**

- Import any `.mid` / `.midi` file
- Drag-and-drop support
- Built-in song library with grades, categories, sorting, favorites, previews, and recent files

**Release and Updates**

- GitHub Releases provide Windows `.exe`, macOS `.dmg`, Linux `.AppImage`, Linux `.deb`, and `SHA256SUMS.txt`
- Settings > About can check GitHub Releases for newer matching installers
- Public builds are currently unsigned/not notarized; see [release-signing.md](docs/release-signing.md)

---

## Installation

Download the latest release for your platform from the [Releases](https://github.com/EndeavorYen/Rexiano/releases) page.

### Windows

1. Download `rexiano-x.x.x-setup.exe`
2. Run the installer and follow the prompts
3. Launch Rexiano from the desktop shortcut or Start Menu

> **Windows SmartScreen warning**: Because the app is not code-signed, Windows may show a "Windows protected your PC" dialog. Click **More info**, then **Run anyway**. This is safe -- the app is open source and you can audit every line of code in this repository.

### macOS

1. Download `rexiano-x.x.x-arm64.dmg` (Apple Silicon) or `rexiano-x.x.x-x64.dmg` (Intel)
2. Open the DMG and drag Rexiano to your Applications folder
3. On first launch, right-click the app and select **Open** (or go to System Settings > Privacy & Security > Open Anyway)

> **Gatekeeper notice**: Since the app is not notarized with Apple, macOS will block it on first launch. The right-click > Open workaround is only needed once.

### Linux

**AppImage** (recommended -- no installation required):

1. Download `rexiano-x.x.x-x86_64.AppImage`
2. Make it executable: `chmod +x rexiano-*.AppImage`
3. Run it: `./rexiano-*.AppImage`

**Debian / Ubuntu**:

1. Download `rexiano-x.x.x-amd64.deb`
2. Install: `sudo dpkg -i rexiano-*.deb`

---

## Bluetooth MIDI Setup

Bluetooth MIDI support depends on the operating system:

| Platform | Setup                                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | Pair the keyboard in Bluetooth settings, then select it in Rexiano.                                                                                                                     |
| Linux    | Pair through BlueZ/ALSA, then select the exposed MIDI port.                                                                                                                             |
| Windows  | Try Rexiano's Bluetooth scan first. If the keyboard does not appear as a MIDI input, install a bridge such as MIDIberry or the KORG BLE-MIDI Driver, then select the bridged MIDI port. |

For detailed steps, see the **[User Guide — Connecting a MIDI Keyboard](docs/user-guide-en.md#5-connecting-a-midi-keyboard)**.

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22 or later
- [pnpm](https://pnpm.io/) 10 or later
- Git

### Quick Start

```bash
# Clone the repository
git clone https://github.com/EndeavorYen/Rexiano.git
cd Rexiano

# Install dependencies
pnpm install

# Start the dev server with hot reload
pnpm dev

# Run in sandbox mode (if not using WSL2)
pnpm dev:sandbox
```

### Scripts

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `pnpm dev`             | Start Electron in development mode with HMR      |
| `pnpm build`           | Typecheck + production build                     |
| `pnpm build:win`       | Build Windows installer (.exe)                   |
| `pnpm build:mac`       | Build macOS disk image (.dmg)                    |
| `pnpm build:linux`     | Build Linux packages (.AppImage, .deb)           |
| `pnpm test`            | Run all tests with Vitest                        |
| `pnpm test:watch`      | Run tests in watch mode                          |
| `pnpm test:e2e`        | Build app and run Playwright Electron E2E tests  |
| `pnpm test:e2e:update` | Build app and update Playwright visual snapshots |
| `pnpm test:visual`     | Build app and run focused UI visual guard tests  |
| `pnpm lint`            | Run ESLint                                       |
| `pnpm typecheck`       | Run TypeScript compiler checks                   |
| `pnpm format`          | Format code with Prettier                        |

Focused UI suites for local changes:

- Accessibility and keyboard flow: `pnpm build && pnpm exec playwright test e2e/accessibility-core.spec.ts`
- Playback layout and visual guardrails: `pnpm build && pnpm exec playwright test e2e/ui-polish.spec.ts`
- Sheet-music dense/key-signature SVG guards: `pnpm build && pnpm exec playwright test e2e/sheet-music-visual-fixtures.spec.ts`
- README screenshots: `pnpm build && pnpm exec playwright test -c scripts/playwright.readme-screenshots.config.ts`

### Project Structure

```
src/
  main/                  # Electron main process
    ipc/                 # IPC handlers (file dialog, MIDI permissions)
  preload/               # Context bridge (secure IPC)
  renderer/src/
    engines/             # Pure logic (no React dependency)
      audio/             # Web Audio API + SoundFont
      fallingNotes/      # PixiJS rendering + ticker loop
      midi/              # MIDI device management + parsing
      practice/          # Wait mode, scoring, speed, loops
    stores/              # Zustand state management
    features/            # React UI components
    themes/              # Theme tokens (CSS custom properties)
resources/               # SoundFont files, bundled MIDI songs
build/                   # Electron-builder resources (icons, entitlements)
```

---

## Tech Stack

| Layer     | Technology                                    | Purpose                                       |
| --------- | --------------------------------------------- | --------------------------------------------- |
| Desktop   | Electron 33                                   | Cross-platform shell, system APIs, packaging  |
| Build     | electron-vite 5 + Vite 7                      | Fast HMR, module bundling                     |
| UI        | React 19 + TypeScript 5.9                     | Component-based interface                     |
| Styling   | Tailwind CSS 4 + CSS Custom Properties        | Theme system                                  |
| State     | Zustand 5                                     | Lightweight global state (8 stores)           |
| Rendering | PixiJS 8                                      | WebGL canvas for falling notes at 60 FPS      |
| MIDI      | @tonejs/midi + Web MIDI API                   | File parsing + live device I/O                |
| Audio     | Web Audio API + SoundFont (soundfont2)        | Piano playback                                |
| Fonts     | @fontsource (Nunito, DM Sans, JetBrains Mono) | Offline, no CDN                               |
| Testing   | Vitest 4 + Playwright 1.58                    | Unit tests + Electron E2E + visual regression |
| Packaging | electron-builder 26                           | Installers for Win / Mac / Linux              |

---

## Documentation

| Document               | English                                            | 繁體中文                                           |
| ---------------------- | -------------------------------------------------- | -------------------------------------------------- |
| **README**             | You are here                                       | [README-zh.md](README-zh.md)                       |
| **User Guide**         | [docs/user-guide-en.md](docs/user-guide-en.md)     | [docs/user-guide.md](docs/user-guide.md)           |
| **Installation Guide** | [docs/installation-en.md](docs/installation-en.md) | [docs/installation.md](docs/installation.md)       |
| **Architecture**       | [docs/architecture.md](docs/architecture.md)       | [docs/architecture-zh.md](docs/architecture-zh.md) |
| **System Design**      | [docs/DESIGN-en.md](docs/DESIGN-en.md)             | [docs/DESIGN.md](docs/DESIGN.md)                   |
| **Roadmap**            | [docs/ROADMAP.md](docs/ROADMAP.md)                 | [docs/ROADMAP.md](docs/ROADMAP.md)                 |
| **Release Signing**    | [docs/release-signing.md](docs/release-signing.md) | [docs/release-signing.md](docs/release-signing.md) |
| **Update Flow**        | [docs/update-flow.md](docs/update-flow.md)         | [docs/update-flow.md](docs/update-flow.md)         |

---

## License

Rexiano is licensed under the [GNU General Public License v3.0](LICENSE).

You are free to use, modify, and distribute this software under the terms of the GPL-3.0 license. If you distribute modified versions, you must also make your source code available under the same license.

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md), the [Architecture doc](docs/architecture.md), and the [System Design doc](docs/DESIGN-en.md) before writing code.

```bash
pnpm lint && pnpm typecheck && pnpm test
```

---

## Acknowledgments

- Built with love for Rex, who is learning to play piano
- [Synthesia](https://www.synthesia.app/) for the original inspiration
- The open-source community for the incredible tools that make this project possible
