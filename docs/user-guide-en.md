# Rexiano User Guide

> **Version**: 1.4.0 | **Last updated**: 2026-08
>
> Other languages: [繁體中文](./user-guide.md)
>
> **TL;DR** - Press **Start Playing**, choose a built-in song or import a MIDI file, then pick **Watch** or **Wait**. Play with falling notes, the piano keyboard, and speed control.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Song Library and MIDI Import](#2-song-library-and-midi-import)
3. [Player](#3-player)
4. [Practice Modes](#4-practice-modes)
5. [Connecting a MIDI Keyboard](#5-connecting-a-midi-keyboard)
6. [Settings](#6-settings)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [FAQ](#8-faq)
9. [Practice Tips](#9-practice-tips)

---

## 1. Quick Start

Rexiano's main flow is: Start Playing -> Song Library -> Watch or Wait.

1. Open Rexiano.
2. On the main menu, press **Start Playing**.
3. In the library, choose a built-in song or use **Import your own MIDI file** for a `.mid` / `.midi` file.
4. Choose **Watch** to listen, or **Wait** so Rexiano pauses until you play the right notes.
5. In the player, press **Space** to play or pause. Use the speed control when a passage is too fast.

![Rexiano song library](./assets/screenshots/rexiano-library.png)

> **Screen callout**: The library lists built-in songs and imported MIDI. Selecting a song opens Watch / Wait.

---

## 2. Song Library and MIDI Import

The library is where you choose songs and import your own MIDI files.

| Area           | What it does                              | Best use                             |
| -------------- | ----------------------------------------- | ------------------------------------ |
| Import MIDI    | Opens a file picker for `.mid` / `.midi`  | Teacher-assigned files and your own  |
| Built-in songs | Packaged practice songs                   | First Watch / Wait sessions          |
| Imported MIDI  | Songs you already imported                | Play them again                      |

### Import Your Own MIDI

1. Press **Import your own MIDI file**, or drag a `.mid` / `.midi` file into the Rexiano window.
2. Rexiano loads playable notes into Watch / Wait. Empty MIDI files are rejected.
3. After import, the file appears in the library. Select it to start Watch / Wait.

---

## 3. Player

The player shows falling notes, the 88-key keyboard, transport controls, Watch / Wait, and speed.

![Rexiano falling-notes practice](./assets/screenshots/rexiano-practice.png)

> **Screen callout**: When a falling note reaches the hit line above the keyboard, it is time to play. The lower controls handle playback, volume, Watch / Wait, and speed.

### Display

| Mode                | What you see                           | Best for                             |
| ------------------- | -------------------------------------- | ------------------------------------ |
| **Notes (Falling)** | Falling notes plus the 88-key keyboard | The default live practice view       |
| **Both (Split)**    | Sheet music above, falling notes below | Optional extra context               |

Sheet-only view is not part of the live player.

### Playback Controls

| Control       | Function                                                    |
| ------------- | ----------------------------------------------------------- |
| Play / Pause  | Starts or pauses the loaded song                            |
| Back to start | Resets playback to 0:00                                     |
| Seek slider   | Jumps to any part of the song                               |
| Volume        | Adjusts Rexiano's internal volume                           |
| Audio status  | Shows loading, recovery, errors, and retry actions          |

---

## 4. Practice Modes

| Mode      | Behavior                                       | Best for                                  |
| --------- | ---------------------------------------------- | ----------------------------------------- |
| **Watch** | Plays automatically while you watch and listen | First pass through a new song             |
| **Wait**  | Pauses at notes until you play them correctly  | Slow practice and fixing wrong notes      |

### Recommended Practice Flow

1. Use **Watch** once to hear the song.
2. Switch to **Wait** and set speed to 50% or 75%.
3. After the passage is steady, raise speed toward 100%.

Speed uses 50% and 100% buttons plus a 25%-200% slider. Start new songs at 50%, not full speed.

Wait mode needs MIDI input for scoring and live key feedback.

---

## 5. Connecting a MIDI Keyboard

You can watch and listen without a keyboard. Wait mode and real key feedback need USB or Bluetooth MIDI input.

### USB Keyboard

1. Connect the keyboard with USB and turn it on.
2. Open Rexiano and go to the library or player.
3. Open the MIDI input selector.
4. Choose your keyboard under **In**.
5. When the status turns green, press a few keys. The on-screen keyboard should light up.

### Bluetooth MIDI

| Platform | Suggested setup                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| macOS    | Pair in system Bluetooth settings, then select the device in Rexiano; the **Bluetooth** button can also scan BLE MIDI |
| Windows  | Pair first, then press **Bluetooth**; if no MIDI input appears, use MIDIberry or KORG BLE-MIDI Driver as a bridge     |
| Linux    | Pair through BlueZ / ALSA, confirm a MIDI port appears, then select it in Rexiano                                     |

If MIDI permission is denied, retry after allowing MIDI access in the operating system.

---

## 6. Settings

Live settings include language and audio only.

| Tab      | Controls                               |
| -------- | -------------------------------------- |
| Language | English / 繁體中文                     |
| Audio    | Volume, mute                           |

The default language is Traditional Chinese.

---

## 7. Keyboard Shortcuts

Shortcuts are ignored while typing in search boxes or metadata fields.

| Shortcut                  | Action                                                |
| ------------------------- | ----------------------------------------------------- |
| `Space`                   | Play / Pause                                          |
| `R`                       | Reset to beginning                                    |
| `←` / `→`                 | Rewind / fast forward 5 seconds                       |
| `Shift + ←` / `Shift + →` | Rewind / fast forward 15 seconds                      |
| `↑` or `]`                | Speed +25%                                            |
| `↓` or `[`                | Speed -25%                                            |
| `1` / `2`                 | Switch Watch / Wait                                   |
| `M`                       | Mute / unmute                                         |
| `Esc`                     | Pause during playback; usually closes focused dialogs |
| `Ctrl+O` / `Cmd+O`        | Open MIDI file                                        |

---

## 8. FAQ

### I cannot hear sound. What should I check?

1. Check Rexiano volume and system volume.
2. Make sure mute is off, or press `M`.
3. The SoundFont can take a few seconds to load the first time; wait if loading is shown.
4. If audio shows an error, use the retry action, or enable audio compatibility mode in Settings and reload the song.

### My MIDI keyboard does not appear. What should I do?

1. USB: unplug and reconnect, try another USB port, and confirm the keyboard is powered on.
2. Bluetooth: pair at the operating-system level first, then press **Bluetooth** in Rexiano.
3. Windows: if pairing works but no MIDI input appears, use MIDIberry or KORG BLE-MIDI Driver.
4. Close DAWs or recording apps that may be holding the MIDI device, then reopen Rexiano.

### I imported a file, but now Rexiano cannot find it.

Recent files remember their original path. If the file moved or was deleted, Rexiano shows a recovery prompt. Import it again from the new location, or remove the stale recent item.

### Why do some notes not show labels?

Very short notes hide text automatically to prevent label overlap. Slow the song down if you need to read names.

### Should I use falling notes or split view?

Start with falling notes to learn which keys to press. Split view is optional extra context above the notes.

---

## 9. Practice Tips

Rexiano works best when practice becomes short, clear, and finishable.

1. **Use 10-20 minute sessions**: build consistency before length.
2. **Start with an easy built-in song**: early wins matter.
3. **Listen before playing**: use Watch once, then Wait.
4. **Slow is faster**: 50% speed with correct notes beats repeated full-speed mistakes.
5. **Praise specific progress**: "That C to G passage was steadier today" helps more than generic praise.

_Rexiano is free, open-source software released under GPL-3.0. Source code: [github.com/EndeavorYen/Rexiano](https://github.com/EndeavorYen/Rexiano)._
