# Rexiano User Guide

> **Version**: 0.4.1 | **Last updated**: 2026-03
>
> Other languages: [繁體中文](./user-guide.md)

---

## Table of Contents

1. [Welcome](#1-welcome)
2. [Installation](#2-installation)
3. [Quick Start](#3-quick-start)
4. [Feature Reference](#4-feature-reference)
5. [Connecting a MIDI Keyboard](#5-connecting-a-midi-keyboard)
6. [Settings Panel](#6-settings-panel)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [FAQ](#8-faq)
9. [Tips for Parents](#9-tips-for-parents)

---

## 1. Welcome

**Rexiano** (Rex + Piano) is a free, open-source piano practice application inspired by Synthesia — but completely free and continuously evolving.

This project started as a father's gift to his six-year-old son Rex — to make learning piano feel as fun as playing a video game. We then open-sourced it so every child and adult learning piano can enjoy the joy of music.

### What Can Rexiano Do?

- **Falling notes display** — Like a rhythm game, notes fall from the top of the screen and you play along
- **Connect your keyboard** — Supports USB and Bluetooth MIDI keyboards (Roland, Yamaha, and more)
- **Three practice modes** — Watch, Wait, and Free, for every stage of learning
- **Real-time scoring** — Hit a note and it glows; chain them for combo effects
- **18 built-in songs** — From Twinkle Twinkle to Moonlight Sonata, ordered by difficulty
- **Import your own MIDI files** — Practice whatever you want
- **4 beautiful themes** — Lavender, Ocean, Peach, Midnight — find your favorite
- **Completely free** — No ads, no paywalls, no subscriptions

### Who Is This Guide For?

Whether you're a parent looking for a practice tool for your child, or an adult learning piano on your own, this guide will walk you through Rexiano step by step. No technical background required.

---

## 2. Installation

For complete installation instructions including system requirements and developer setup, see the dedicated **[Installation Guide](./installation-en.md)**.

**Quick links:**

- [Windows Installation](./installation-en.md#2-windows-installation)
- [macOS Installation](./installation-en.md#3-macos-installation)
- [Linux Installation](./installation-en.md#4-linux-installation)
- [Developer Setup](./installation-en.md#7-developer-setup)

---

## 3. Quick Start

Up and running in 5 minutes! Follow these steps to start your first practice session.

### Step 1: Choose a Song

When Rexiano launches, you'll see the **Song Library** screen. It lists 18 built-in songs organized by difficulty:

| Difficulty   | Good for                | Example songs                                           |
| ------------ | ----------------------- | ------------------------------------------------------- |
| Beginner     | Just starting out       | Twinkle Twinkle, Mary Had a Little Lamb, Happy Birthday |
| Intermediate | Some experience         | Ode to Joy, On Wings of Song, Minuet in G               |
| Advanced     | Looking for a challenge | Moonlight Sonata, Für Elise                             |

Click any song card to load it.

> **Tip**: If you have your own MIDI file, click the "Open File" button in the top-right corner to import it, or drag and drop a `.mid` file directly into the Rexiano window.

### Step 2: Press Space to Play

After selecting a song, you'll see the falling notes view. There's a horizontal line in the middle of the screen (the hit line) — notes fall from above and pass through it.

Press **Space** to start playback. Notes fall in time with the music. Watch and listen first to get a feel for the rhythm.

Press **Space** again to pause.

### Step 3: Choose a Practice Mode

In the Practice Toolbar at the bottom of the screen, you can switch between three modes:

- **Watch** — Listen only; music plays automatically. Great for getting familiar with a new song.
- **Wait** — Music pauses at each note and waits for you to play the correct key. This is the most recommended mode!
- **Free** — Music plays continuously and you play along. The system tracks your accuracy in real time.

For beginners, we recommend: start with **Watch** mode to listen through, then switch to **Wait** mode for hands-on practice.

### That's It!

You've learned the core of Rexiano. The following sections cover more advanced features, but you can start practicing right now. Enjoy the music!

---

## 4. Feature Reference

### 4.1 Falling Notes Display

The core of Rexiano is the **Falling Notes** view. It works like a piano roll turned upside down:

```
  Time flows downward
         │
         ▼
  ┌──────────────────────────────┐
  │                              │  Upcoming notes
  │    ┌──┐     ┌────┐          │
  │    │  │     │    │          │  Note rectangles
  │    └──┘     └────┘          │  (colors indicate tracks)
  │                              │
  │ ───── hit line ───────────── │  ← Current playback position
  ├──────────────────────────────┤
  │  Piano keyboard (88 keys)    │  ← Keys light up as notes arrive
  └──────────────────────────────┘
```

- The **horizontal position** of a note rectangle corresponds to the piano key
- The **height** of the rectangle represents the note's duration
- Different **tracks** (voices) use different colors — typically Track 1 = right hand, Track 2 = left hand
- **Note name labels** (e.g., C4, F#5) are shown on the rectangles to help you identify notes
- **Key names** are shown on the piano keys (can be turned off in Settings)

### 4.2 Playback Controls (TransportBar)

The TransportBar at the bottom provides:

| Element           | Description                                        |
| ----------------- | -------------------------------------------------- |
| Play/Pause button | Start or pause playback (or press Space)           |
| Time display      | Shows current position / total duration            |
| Seek bar          | Drag to jump to any position                       |
| Volume control    | Adjust playback volume                             |
| Metronome button  | Toggle metronome on/off (clock icon)               |
| Audio status      | Spinning icon while loading; warning icon on error |

### 4.3 Practice Modes

#### Watch Mode

Music plays automatically. You just watch and listen. Best for:

- Hearing a new song for the first time
- Observing how notes are distributed between hands
- Pure enjoyment

#### Wait Mode — Most Recommended!

This is Rexiano's signature practice feature:

1. Music plays normally
2. When the next note reaches the hit line, **music automatically pauses**
3. You play the **correct key** on your keyboard — then music resumes
4. For chords (multiple simultaneous notes), you must press **all notes** to advance
5. There's a 200 ms tolerance window — you don't need split-second timing

This mode lets you practice at your own pace — you're never rushed by the music, and mistakes aren't penalized.

#### Free Mode

Music plays continuously without pausing. Play along in real time:

- Hit a note: it briefly glows
- Miss a note: it turns gray

Best for when you know the song fairly well and want to test your reaction speed.

### 4.4 Speed Control

New songs often feel too fast at full speed. Rexiano lets you adjust playback speed:

- Speed range: **0.25x** (quarter speed) to **2.0x** (double speed)
- Preset buttons: 25% / 50% / 75% / 100% — one-click common speeds
- Continuous slider: fine-tune to any speed
- Keyboard shortcut: **Up/Down arrow keys** to adjust in 25% increments

We recommend starting a new song at 50%, building confidence, then gradually increasing toward 100%.

### 4.5 A-B Loop

Found a tricky passage? Use the A-B loop to repeat it over and over:

1. Find the **A-B Loop** controls in the Practice Toolbar
2. Press the **A** button to set the loop start point
3. Press the **B** button to set the loop end point
4. Music will automatically jump back to A when it reaches B
5. A colored highlight on the seek bar shows the loop range
6. Press **L** or click again to cancel the loop

### 4.6 Split-Hand Practice

Many piano pieces have two voices: right-hand melody and left-hand accompaniment. Rexiano lets you practice each hand separately:

1. Find the **Track** selector in the Practice Toolbar
2. Check the track(s) you want to practice
3. Unchecked tracks still play audio (as accompaniment) but aren't scored
4. Scoring counts only the tracks you've selected

Typical practice order: right hand first → left hand next → both hands together.

### 4.7 Scoring & Celebration

In Wait and Free modes, Rexiano tracks your performance:

**Real-time feedback:**

- The **Score Overlay** in the top-right shows live accuracy and combo count
- Hitting a note makes it **briefly glow**
- Missing or hitting the wrong note makes it **turn gray**
- Reaching combo milestones triggers **special effects**

**End-of-session results:**
When you finish a song (or stop playback), a results screen appears based on accuracy:

| Accuracy     | Effect                                           |
| ------------ | ------------------------------------------------ |
| 90% or above | Full-screen celebration animation + "Excellent!" |
| 70%–89%      | Star effect + "Well done!"                       |
| Below 70%    | Encouraging text + "Try again?"                  |

Every session's score is automatically saved. In the song library, you'll see best-score badges:

- Gold badge: 90%+ accuracy
- Silver badge: 70%–89% accuracy
- Green badge: below 70% accuracy

If you beat your previous best, a "New Record!" highlight appears on the results screen.

---

## 5. Connecting a MIDI Keyboard

Rexiano supports connecting an external MIDI keyboard for practicing on real keys. You can use Rexiano's Watch mode without a keyboard, but Wait mode and scoring require one.

### 5.1 USB MIDI Keyboard (Plug and Play)

The easiest connection method:

1. Connect your MIDI keyboard to your computer with a USB cable
2. Open Rexiano
3. Find the MIDI device icon in the song view header
4. Click the device selector — your keyboard should appear in the list
5. Select your keyboard as the input device
6. The status indicator turns **green** when connected
7. Press a few keys — the on-screen piano keys should light up

> **Tip**: If your keyboard has built-in speakers (like a Roland digital piano), you can also set it as an output device in the selector, so Rexiano plays audio through your keyboard's speakers.

### 5.2 Bluetooth MIDI Keyboard

Bluetooth MIDI setup varies by operating system:

#### macOS

macOS natively supports Bluetooth MIDI — the easiest setup:

1. Turn on your keyboard's Bluetooth
2. Pair your keyboard in macOS System Settings > Bluetooth
3. After pairing, return to Rexiano
4. Your Bluetooth keyboard will appear automatically in the MIDI device list
5. Select it and you're ready

You can also use the "Bluetooth" button inside Rexiano to scan for nearby BLE MIDI devices.

#### Windows

Rexiano connects to Bluetooth MIDI keyboards directly on Windows — no bridge software required:

1. Turn on your keyboard's Bluetooth
2. Pair your keyboard in Windows Settings > Bluetooth & devices
3. Return to Rexiano and click the "Bluetooth" scan button in the device selector
4. Select your keyboard when it appears in the list

#### Linux

1. Pair your Bluetooth MIDI keyboard using BlueZ:
   ```bash
   bluetoothctl
   scan on
   pair [device-address]
   connect [device-address]
   ```
2. After pairing, the keyboard appears as an ALSA MIDI device
3. Select the corresponding MIDI port in Rexiano

### 5.3 Testing Your Connection

Not sure if your keyboard is connected? Use the **Test** button in the device selector:

1. After selecting an input device, find the Test button
2. Click it — Rexiano enters test mode
3. Play a few notes on your keyboard
4. If the on-screen piano keys respond (light up), you're connected
5. Test mode ends automatically

### 5.4 Latency Compensation

Bluetooth connections can introduce a small delay. If Wait mode judgments feel off, adjust the latency compensation:

1. Open Settings (gear icon)
2. Find the "Latency Compensation" slider
3. Start at 0 ms and increase gradually (10–30 ms is typical for BLE) until judgments feel accurate
4. USB connections usually don't need any compensation (keep at 0 ms)

### 5.5 Connection Status Indicator

A small dot next to the device selector shows connection status:

| Color | Meaning                                    |
| ----- | ------------------------------------------ |
| Green | Connected, all good                        |
| Gray  | No device connected                        |
| Red   | Connection error (check cables or re-pair) |

---

## 6. Settings Panel

Click the **gear icon** in the top-right of the song view to open Settings.

### 6.1 Display Settings

| Setting          | Description                                                                          | Default |
| ---------------- | ------------------------------------------------------------------------------------ | ------- |
| Piano key labels | Show note names (C, D, E, etc.) on white keys; C keys show octave numbers (e.g., C4) | On      |
| Note name labels | Show note names (e.g., C4, F#5) on falling note rectangles                           | On      |

### 6.2 Audio Settings

| Setting | Description                  | Default |
| ------- | ---------------------------- | ------- |
| Volume  | Master volume, 0–100%        | 80%     |
| Mute    | One-click mute (shortcut: M) | Off     |

### 6.3 Practice Defaults

| Setting       | Description                               | Default     |
| ------------- | ----------------------------------------- | ----------- |
| Default speed | Initial speed when starting a new session | 100% (1.0x) |
| Default mode  | Initial mode when starting a new session  | Watch       |

### 6.4 Metronome Settings

| Setting        | Description                                     | Default |
| -------------- | ----------------------------------------------- | ------- |
| Metronome      | Toggle metronome on/off                         | Off     |
| Count-in beats | Number of beats to count before playback starts | 4 beats |

### 6.5 Latency Compensation

| Setting              | Description                                         | Default |
| -------------------- | --------------------------------------------------- | ------- |
| Latency compensation | Compensate for MIDI keyboard input delay (0–100 ms) | 0 ms    |

### 6.6 Theme Selection

Rexiano offers four carefully designed visual themes:

| Theme        | Style                                     | Best for                         |
| ------------ | ----------------------------------------- | -------------------------------- |
| **Lavender** | Soft purple, warm and elegant             | Daytime practice                 |
| **Ocean**    | Serene ocean blue, clean and open         | Daytime practice                 |
| **Peach**    | Warm sunset orange, energetic             | Daytime practice                 |
| **Midnight** | Deep starry black with neon-colored notes | Night practice, dim environments |

Your selected theme is automatically saved and restored on the next launch.

---

## 7. Keyboard Shortcuts

Below are all keyboard shortcuts. Press **?** at any time to show/hide the shortcut reference on screen.

### Playback Controls

| Shortcut    | Action                  |
| ----------- | ----------------------- |
| `Space`     | Play / Pause            |
| `R`         | Reset to beginning      |
| `←`         | Rewind 5 seconds        |
| `→`         | Fast forward 5 seconds  |
| `Shift + ←` | Rewind 15 seconds       |
| `Shift + →` | Fast forward 15 seconds |

### Practice Controls

| Shortcut | Action                                     |
| -------- | ------------------------------------------ |
| `↑`      | Increase speed by 25% (e.g., 1.0x → 1.25x) |
| `↓`      | Decrease speed by 25% (e.g., 1.0x → 0.75x) |
| `1`      | Switch to Watch mode                       |
| `2`      | Switch to Wait mode                        |
| `3`      | Switch to Free mode                        |
| `L`      | Clear A-B loop                             |

### Other

| Shortcut                                | Action                         |
| --------------------------------------- | ------------------------------ |
| `M`                                     | Mute / Unmute                  |
| `Ctrl+O` (Win/Linux) or `Cmd+O` (macOS) | Open MIDI file                 |
| `?`                                     | Show / hide shortcut reference |

---

## 8. FAQ

### Q: I can't hear any sound. What should I do?

1. **Check Rexiano's volume**: Make sure the volume slider isn't at 0% and mute isn't on (press M to toggle)
2. **Check system volume**: Make sure your computer's system audio isn't muted
3. **Wait for loading**: On first play, the SoundFont audio file takes a few seconds to load. If the TransportBar shows a spinning icon, please wait
4. **Audio load failure**: If the TransportBar shows a red warning icon, audio failed to load. Try restarting Rexiano
5. **Browser audio policy**: Modern browsers (including Electron) require user interaction before activating the audio engine. Make sure you've clicked Play or pressed Space

### Q: My keyboard isn't being detected. What should I do?

**USB keyboard:**

- Unplug the USB cable, wait 3 seconds, plug it back in
- Try a different USB port
- Make sure the keyboard is powered on
- Reselect your keyboard in Rexiano's device selector

**Bluetooth keyboard:**

- Make sure Bluetooth is enabled on your keyboard
- Make sure you've completed OS-level Bluetooth pairing
- Windows users: make sure the keyboard was paired in OS Bluetooth settings first
- Try unpairing and re-pairing

**General troubleshooting:**

- Restart Rexiano
- Check that no other application (e.g., a DAW) is using the MIDI device

### Q: How do I import my own MIDI file?

Three ways:

1. **Drag and drop** (easiest): Drag a `.mid` or `.midi` file directly into the Rexiano window
2. **File dialog**: Press `Ctrl+O` (Windows/Linux) or `Cmd+O` (macOS) and select a file
3. **"Open File" button**: Click the button in the top-right of the song library

Good sources for MIDI files:

- [MuseScore](https://musescore.com/) — large library of free sheet music with MIDI export
- [IMSLP](https://imslp.org/) — public domain classical music MIDI
- Any MIDI-capable software (GarageBand, FL Studio, etc.)

### Q: How do I handle the Windows SmartScreen warning?

Rexiano doesn't currently have a Windows Code Signing Certificate, so SmartScreen may warn you on first install. **Rexiano is not malware.**

Steps:

1. When you see "Windows protected your PC", click **"More info"**
2. Click **"Run anyway"**
3. Continue with installation

Rexiano is fully open-source — you can review all source code on [GitHub](https://github.com/nickhsu-endea/Rexiano).

### Q: Where are my recently opened files?

At the top of the song library, you'll see a "Recent" section listing the 10 most recently opened MIDI files. Click any entry to reload it instantly — no need to navigate to the file dialog again.

### Q: Why don't some notes show a label?

If a note's duration is very short (rectangle height smaller than 16 pixels), Rexiano automatically hides the note name label to prevent text overflow and overlap. This is normal and typically happens with very fast ornamental notes or 32nd notes.

### Q: Which MIDI keyboards are supported?

Rexiano supports any MIDI-standard keyboard, including but not limited to:

- Roland (FP-30X, FP-60X, GO:KEYS, etc.)
- Yamaha (P-125, CLP series, etc.)
- Casio (PX series, CDP series, etc.)
- Korg, M-Audio, Arturia, and other brands
- Any USB or Bluetooth MIDI controller

---

## 9. Tips for Parents

Rexiano was born from a father's love for his child's musical journey. Here are some suggestions for making practice more enjoyable and effective.

### 15–20 Minutes a Day Is Enough

For children aged 6–10, 15–20 minutes of focused daily practice is far more effective than a single hour-long session. Short sessions are easier to turn into habits, and children won't feel burdened.

**Tip**: Schedule practice at the same time each day (e.g., before dinner or after homework), so it becomes part of the daily routine.

### Start with Easy Songs

Rexiano's built-in songs are organized by difficulty level. Always start with **Beginner** songs:

- _Twinkle Twinkle Little Star_ — the classic first song
- _Mary Had a Little Lamb_ — only a few notes
- _Hot Cross Buns_ — playable with just three notes

Let your child build confidence with easy songs before moving to harder ones.

### Use Wait Mode + Slow Speed

The most recommended practice combination:

1. Switch to **Wait mode** (press 2)
2. Set speed to **50%** (press the Down arrow a few times)
3. Let your child play at their own pace, one note at a time

Wait mode removes the frustration of falling behind the music; slow speed gives enough reaction time. Once a passage is comfortable, gradually increase the speed.

### Celebrate Progress, Not Perfection

Rexiano's scoring system is designed to encourage, not pressure.

- Accuracy improved from 40% to 60%? That's real progress!
- Chained 5 more notes than last time? That's worth celebrating!
- Finished a song from beginning to end for the first time? That's a milestone!

Every child learns at their own pace. What matters is enjoying the process, not chasing scores. When your child watches their badge change from green to silver to gold, that sense of achievement becomes the best motivation to keep practicing.

### Play Together!

Sometimes, sitting at the piano together — watching notes fall in Watch mode, talking about whether you like the song, clapping along to the rhythm — matters more than any practice technique.

Music's greatest gift is that it connects people.

We hope you and your child find the joy of music in Rexiano!

---

_Rexiano is free, open-source software released under GPL-3.0._
_Source code: [github.com/nickhsu-endea/Rexiano](https://github.com/nickhsu-endea/Rexiano)_
