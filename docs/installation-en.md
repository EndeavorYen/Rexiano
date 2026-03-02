# Rexiano Installation Guide

> **Version**: 0.4.1 | **Last updated**: 2026-03
>
> Other languages: [繁體中文](./installation.md)

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Windows Installation](#2-windows-installation)
3. [macOS Installation](#3-macos-installation)
4. [Linux Installation](#4-linux-installation)
5. [First Launch Notes](#5-first-launch-notes)
6. [Uninstalling](#6-uninstalling)
7. [Developer Setup](#7-developer-setup)

---

## 1. System Requirements

| Item | Minimum | Recommended |
|------|---------|-------------|
| OS | Windows 10 / macOS 12 / Ubuntu 20.04 | Latest version |
| RAM | 4 GB | 8 GB or more |
| Storage | 200 MB | 500 MB |
| GPU | OpenGL 2.0 support | Dedicated GPU |
| Network | Not required (fully offline) | — |

> **Note**: Rexiano uses WebGL for rendering falling notes. Outdated GPU drivers may affect performance. Updating to the latest drivers is recommended.

---

## 2. Windows Installation

### Steps

1. Go to the [GitHub Releases page](https://github.com/nickhsu-endea/Rexiano/releases) and download the latest version
2. Download the `rexiano-x.x.x-setup.exe` file
3. Double-click the installer to run it

### Handling the Windows SmartScreen Warning

On first install, Windows Defender SmartScreen may show a "Windows protected your PC" warning. **This does not mean Rexiano is malware.**

Why this happens: Rexiano currently does not have an EV Code Signing Certificate for Windows. SmartScreen flags all unsigned applications. Rexiano is fully open-source — you can review every line of source code on [GitHub](https://github.com/nickhsu-endea/Rexiano).

How to proceed:
1. Click **"More info"**
2. Click **"Run anyway"**
3. Follow the installer wizard to complete installation

### After Installation

A Rexiano shortcut will appear on your desktop. You can also find Rexiano in the Start Menu.

---

## 3. macOS Installation

### Steps

1. Go to the [GitHub Releases page](https://github.com/nickhsu-endea/Rexiano/releases) and download the latest version
2. Download the `rexiano-x.x.x.dmg` file
3. Double-click the DMG to open it
4. Drag the **Rexiano** icon into the **Applications** folder

### Handling the macOS Security Warning

On first launch, macOS Gatekeeper may show an **"unidentified developer"** warning.

How to proceed:
1. Go to **System Settings** > **Privacy & Security**
2. Scroll to the bottom to find the Rexiano notice
3. Click **"Open Anyway"**

> macOS 14+: Go to System Settings > General > VPN & Device Management. Alternatively, in Finder, hold Control and click Rexiano, then select "Open".

### Apple Silicon (M1/M2/M3/M4)

Rexiano natively supports Apple Silicon. The DMG contains a Universal Binary — no Rosetta 2 translation layer is needed.

---

## 4. Linux Installation

Rexiano is available in three Linux formats. Choose the one that fits your distribution.

### 4.1 AppImage (Recommended — No Installation Required)

AppImage runs on any Linux distribution without installing anything.

```bash
# 1. Download the AppImage
wget https://github.com/nickhsu-endea/Rexiano/releases/latest/download/rexiano-x.x.x.AppImage

# 2. Make it executable
chmod +x rexiano-x.x.x.AppImage

# 3. Run it
./rexiano-x.x.x.AppImage
```

If it doesn't run, you may need to install FUSE:
```bash
# Ubuntu / Debian
sudo apt install fuse libfuse2

# Fedora
sudo dnf install fuse fuse-libs
```

### 4.2 Debian / Ubuntu (.deb)

```bash
# Download and install
wget https://github.com/nickhsu-endea/Rexiano/releases/latest/download/rexiano-x.x.x.deb
sudo dpkg -i rexiano-x.x.x.deb

# Fix missing dependencies if needed
sudo apt-get install -f
```

After installation, Rexiano will appear in your application menu, or you can run it with `rexiano` in the terminal.

### 4.3 RPM (Fedora / RHEL / openSUSE)

```bash
# Fedora / RHEL
sudo rpm -i rexiano-x.x.x.rpm

# openSUSE
sudo zypper install rexiano-x.x.x.rpm
```

### 4.4 MIDI Support on Linux

Before connecting a USB MIDI keyboard on Linux, verify the ALSA driver is loaded:

```bash
# Check if MIDI devices are detected
aconnect -l

# If ALSA doesn't detect your device, load the module
sudo modprobe snd-usb-audio
```

---

## 5. First Launch Notes

### Onboarding Guide

On first launch, Rexiano shows a 4-step interactive guide that introduces the basic controls. It takes about 1 minute to complete. You can replay it anytime from Settings > Replay Onboarding.

### Audio Loading

Rexiano ships with a built-in piano SoundFont (~6 MB) stored inside the application. **No internet connection is required.**

When you play a song for the first time, the SoundFont loads in the background (3–5 seconds). The TransportBar shows a spinning indicator while loading. Once loaded, the audio stays in memory for the duration of the session.

If SoundFont loading fails, Rexiano automatically falls back to a sine-wave synthesizer — all features continue to work, just with a simpler sound.

### MIDI Keyboard

- **USB connection**: Plug in your keyboard and Rexiano will detect it automatically. If it doesn't appear, click the device selector to refresh.
- **Bluetooth connection**: Pair your keyboard in your OS first, then select it in Rexiano. See [User Guide — Connecting a MIDI Keyboard](./user-guide-en.md#5-connecting-a-midi-keyboard) for detailed instructions.

---

## 6. Uninstalling

### Windows

1. Open **Settings** > **Apps** > **Installed apps**
2. Search for "Rexiano"
3. Click **Uninstall**

User data (practice progress, settings) is stored separately and must be deleted manually:
- Windows: `%APPDATA%\Rexiano` (e.g., `C:\Users\YourName\AppData\Roaming\Rexiano`)

### macOS

1. Drag Rexiano from the Applications folder to Trash
2. Empty Trash

User data is located at: `~/Library/Application Support/Rexiano`

### Linux (AppImage)

Simply delete the `.AppImage` file. User data is at: `~/.config/Rexiano`

### Linux (.deb)

```bash
sudo dpkg -r rexiano
# Complete removal including config files
sudo dpkg -P rexiano
```

---

## 7. Developer Setup

If you want to build Rexiano from source or contribute to development, follow these steps.

### Prerequisites

| Tool | Version | Installation |
|------|---------|-------------|
| Node.js | 20+ | [nodejs.org](https://nodejs.org/) |
| pnpm | 9+ | `npm install -g pnpm` |
| Git | Any | [git-scm.com](https://git-scm.com/) |

### Clone and Start

```bash
# Clone the repository
git clone https://github.com/nickhsu-endea/Rexiano.git
cd Rexiano

# Install dependencies
pnpm install

# Start in development mode (Electron + HMR)
pnpm dev
```

### Common Commands

```bash
pnpm dev          # Development mode with hot module replacement
pnpm build        # Build production installer
pnpm lint         # ESLint code check
pnpm typecheck    # TypeScript type check
pnpm test         # Run all tests
pnpm test:watch   # Test watch mode
```

### WSL2 Notes (Windows Developers)

Running Electron inside WSL2 requires these additional steps:

```bash
# VS Code terminal may set this — unset it first
unset ELECTRON_RUN_AS_NODE

# Chromium needs sandbox disabled in WSL2
NO_SANDBOX=1 pnpm dev
```

---

*Rexiano is free, open-source software released under GPL-3.0.*
*Source code: [github.com/nickhsu-endea/Rexiano](https://github.com/nickhsu-endea/Rexiano)*
