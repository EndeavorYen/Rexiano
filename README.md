<p align="center">
  <img src="docs/figure/Rexiano_icon.png" alt="Rexiano icon" width="120" />
</p>

<h1 align="center">Rexiano</h1>

<p align="center">
  <b>Open-source piano practice app with falling notes, MIDI keyboard support, and focused training tools.</b><br />
  Built by a dad for his son, then shared with everyone.
</p>

<p align="center">
  <a href="https://github.com/nickhsu-endea/Rexiano/actions/workflows/ci.yml">
    <img src="https://github.com/nickhsu-endea/Rexiano/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://github.com/nickhsu-endea/Rexiano/actions/workflows/ci.yml">
    <img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/nickhsu-endea/COVERAGE_GIST_ID/raw/rexiano-coverage.json" alt="Coverage" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="GPL-3.0" />
  </a>
</p>

<p align="center">
  <a href="README-zh.md">繁體中文</a> | <b>English</b>
</p>

---

## Why Rexiano

Rexiano is designed for one goal: make piano practice less frustrating and more consistent.

- Learn timing and hand coordination with a 60 FPS falling-notes view.
- Plug in USB or Bluetooth MIDI keyboards and play instantly.
- Slow down hard passages, loop tricky bars, and practice with purpose.
- Keep a clean desktop flow with no account wall and no paywall lock-in.

---

## Highlights

| Area | What You Get |
| --- | --- |
| Visual Training | Falling notes (WebGL), 88-key keyboard feedback, left/right hand colors |
| Practice Engine | Watch / Wait / Free modes, A-B loop, split-hand practice, speed 0.25x-2.0x |
| MIDI | USB + Bluetooth MIDI input/output, hot-plug detection, auto-reconnect, sustain pedal (CC64) |
| Audio | SoundFont piano playback, master volume, synthesizer fallback |
| Library | Built-in songs with difficulty metadata, plus drag-and-drop `.mid` / `.midi` import |
| Themes | Four built-in themes powered by CSS custom properties |

---

## Install

Download the latest build from [Releases](https://github.com/nickhsu-endea/Rexiano/releases).

### Windows

1. Download `Rexiano-x.x.x-setup.exe`.
2. Run installer and complete setup.
3. Launch from Start Menu or desktop shortcut.

`Windows protected your PC` may appear because the app is not code-signed yet. Click `More info` -> `Run anyway` once.

### macOS

1. Download `Rexiano-x.x.x-arm64.dmg` (Apple Silicon) or `Rexiano-x.x.x-x64.dmg` (Intel).
2. Open DMG and drag Rexiano into `Applications`.
3. First launch: right-click app -> `Open` (or allow in `Privacy & Security`).

### Linux

AppImage:

1. Download `Rexiano-x.x.x-x86_64.AppImage`.
2. Run `chmod +x Rexiano-*.AppImage`.
3. Start with `./Rexiano-*.AppImage`.

Debian/Ubuntu:

1. Download `Rexiano-x.x.x-amd64.deb`.
2. Install with `sudo dpkg -i Rexiano-*.deb`.

For Bluetooth setup details, see [docs/installation-en.md](docs/installation-en.md).

---

## Quick Start For Developers

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- Git

### Run Locally

```bash
git clone https://github.com/nickhsu-endea/Rexiano.git
cd Rexiano
pnpm install
pnpm dev
```

If you need sandbox mode:

```bash
pnpm dev:sandbox
```

### Core Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start Electron in dev mode with HMR |
| `pnpm build` | Typecheck and production build |
| `pnpm test` | Run all Vitest tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm test:e2e` | Build app and run Playwright Electron E2E tests |
| `pnpm test:visual` | Run visual regression snapshot tests |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm format` | Format with Prettier |

---

## Architecture Snapshot

```text
src/
  main/            Electron main process + IPC handlers
  preload/         Secure context bridge
  renderer/src/
    engines/       Core logic (audio, midi, practice, falling notes)
    stores/        Zustand state stores
    features/      React UI features
    themes/        Theme tokens
resources/         MIDI library + sound assets
build/             Packaging assets
```

---

## Tech Stack

Electron 33, React 19, TypeScript 5.9, Tailwind CSS 4, Zustand 5, PixiJS 8, Web MIDI API, Web Audio API, SoundFont2, OpenSheetMusicDisplay, VexFlow, Vitest 4, Playwright, electron-builder.

---

## Docs

| Document | English | 繁體中文 |
| --- | --- | --- |
| README | You are here | [README-zh.md](README-zh.md) |
| User Guide | [docs/user-guide-en.md](docs/user-guide-en.md) | [docs/user-guide.md](docs/user-guide.md) |
| Installation | [docs/installation-en.md](docs/installation-en.md) | [docs/installation.md](docs/installation.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) | [docs/architecture-zh.md](docs/architecture-zh.md) |
| System Design | [docs/DESIGN-en.md](docs/DESIGN-en.md) | [docs/DESIGN.md](docs/DESIGN.md) |
| Roadmap | [docs/ROADMAP.md](docs/ROADMAP.md) | [docs/ROADMAP.md](docs/ROADMAP.md) |

---

## Contributing

Contributions are welcome. Please read [docs/architecture.md](docs/architecture.md) and [docs/DESIGN-en.md](docs/DESIGN-en.md) before implementing major changes.

```bash
pnpm lint && pnpm typecheck && pnpm test
```

---

## License

Licensed under [GNU GPL-3.0](LICENSE).
