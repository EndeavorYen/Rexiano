# Rexiano — 系統設計文件

> **版本**: 1.1
> **日期**: 2026-02-27
> **狀態**: 草稿（Phase 6.5 已新增）

---

## 目錄

1. [專案願景](#1-專案願景)
2. [技術架構總覽](#2-技術架構總覽)
3. [Phase 1 — 專案骨架與 MIDI 解析（已完成）](#3-phase-1--專案骨架與-midi-解析)
4. [Phase 2 — 下落音符引擎（已完成）](#4-phase-2--下落音符引擎)
5. [Phase 3 — UI 主題系統（已完成）](#5-phase-3--ui-主題系統)
6. [Phase 4 — 音頻播放（已完成）](#6-phase-4--音頻播放)
7. [Phase 5 — MIDI 裝置連接（已完成）](#7-phase-5--midi-裝置連接)
8. [Phase 6 — 練習模式](#8-phase-6--練習模式)
9. [Phase 6.5 — 兒童可用性增強](#9-phase-65--兒童可用性增強)
10. [Phase 7 — 樂譜顯示](#10-phase-7--樂譜顯示)
11. [Phase 8 — 樂譜編輯（Extra）](#11-phase-8--樂譜編輯)
12. [Phase 9 — 打包與發佈](#12-phase-9--打包與發佈)
13. [Synthesia 功能對照](#13-synthesia-功能對照)
14. [跨領域關注點](#14-跨領域關注點)

---

## 1. 專案願景

Rexiano（Rex + Piano）是一套開源、跨平台的鋼琴練習應用，目標是成為 Synthesia 的替代方案。專案為我的兒子 Rex 而生，同時開源給所有鋼琴愛好者使用。

### 六大核心功能

| # | 功能 | 說明 |
|---|------|------|
| 1 | MIDI 匯入 | 載入 `.mid` 檔案，解析為結構化資料 |
| 2 | 視覺化顯示 | 下落式音符（節奏遊戲風格）＋ 琴鍵 ＋ 五線譜 |
| 3 | MIDI 裝置連接 | 藍牙 / USB MIDI 鍵盤（如 Roland）的輸入與輸出 |
| 4 | 跨平台 | Windows / macOS / Linux 原生安裝檔 |
| 5 | 樂譜編輯 | （Extra）匯入、建立、編輯 MIDI / MusicXML |
| 6 | 練習模式 | 速度控制、段落循環、分手練習、評分回饋 |

### 技術選型決策

選擇 **Electron + React** 而非 Python (PyQt/Pygame) 的理由：

- Web MIDI API 在 Chromium 內核中有完整支援，藍牙 MIDI 裝置只需作業系統配對即可使用
- PixiJS (WebGL) 可在 Canvas 上以 60 FPS 渲染上千個音符，DOM 渲染在 200+ 元素時會崩潰
- VexFlow / OSMD 等 JS 函式庫可直接渲染互動式五線譜，Python 生態中缺乏同等工具
- Electron 打包成一鍵安裝檔，比 PyInstaller 對非技術使用者更友善

---

## 2. 技術架構總覽

### 技術堆疊

| 層級 | 技術 | 用途 |
|------|------|------|
| 桌面框架 | Electron 33 | 跨平台視窗、系統 API、打包 |
| 建置工具 | electron-vite 5 + Vite 7 | 快速 HMR、模組打包 |
| UI 框架 | React 19 + TypeScript 5.9 | 元件化 UI |
| 樣式 | Tailwind CSS 4 + CSS Custom Properties | 主題系統 |
| 狀態管理 | Zustand 5 | 輕量全域狀態（song、playback、theme） |
| 渲染引擎 | PixiJS 8 | WebGL 高效能 Canvas 渲染 |
| MIDI 解析 | @tonejs/midi | 解析 `.mid` 檔案 |
| 字型 | @fontsource (Nunito, DM Sans, JetBrains Mono) | 離線字型，無 CDN 依賴 |
| 測試 | Vitest 4 | 單元測試 |
| 打包 | electron-builder 26 | 產出安裝檔 |

### 程序架構圖

```
┌─────────────────────────────────────────────────────────┐
│  Electron Main Process                                  │
│  ┌───────────────┐  ┌───────────────┐                   │
│  │ fileHandlers  │  │ midiDevice*   │  ← Phase 5 新增   │
│  │ (IPC: dialog) │  │ (IPC: MIDI)   │                   │
│  └───────┬───────┘  └───────┬───────┘                   │
│          │ IPC (contextBridge)│                          │
├──────────┼──────────────────┼───────────────────────────┤
│  Renderer Process (React)   │                           │
│  ┌──────────────────────────┴────────────────────────┐  │
│  │  Zustand Stores                                   │  │
│  │  ┌────────────┐ ┌──────────────┐ ┌─────────────┐ │  │
│  │  │ songStore  │ │playbackStore │ │ themeStore  │ │  │
│  │  ├────────────┤ ├──────────────┤ ├─────────────┤ │  │
│  │  │midiDevice* │ │settingsStore*│ │progressStore│ │  │
│  │  └─────┬──────┘ └──────┬───────┘ └──────┬──────┘ │  │
│  │        │               │                │        │  │
│  │  ┌─────┴───────────────┴────────────────┴─────┐  │  │
│  │  │              App.tsx (Router)               │  │  │
│  │  │  ┌─────────────────────────────────────┐   │  │  │
│  │  │  │  FallingNotesCanvas (PixiJS)        │   │  │  │
│  │  │  │  ├─ NoteRenderer (sprite pool)      │   │  │  │
│  │  │  │  ├─ ViewportManager (座標映射)       │   │  │  │
│  │  │  │  └─ tickerLoop (每幀更新)           │   │  │  │
│  │  │  ├─────────────────────────────────────┤   │  │  │
│  │  │  │  TransportBar (播放控制)             │   │  │  │
│  │  │  ├─────────────────────────────────────┤   │  │  │
│  │  │  │  PianoKeyboard (88 鍵視覺化)        │   │  │  │
│  │  │  └─────────────────────────────────────┘   │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### IPC 通信策略

Electron 的 Main Process 與 Renderer Process 之間透過 `contextBridge` 溝通。為避免 `Uint8Array` 在 structured clone 時遺失型別，所有二進位資料一律用 `number[]` 傳遞，Renderer 端再轉回。

### 目錄結構

```
src/
├── main/                        # Electron 主程序
│   ├── index.ts                 # 視窗建立、app 生命週期
│   └── ipc/
│       ├── fileHandlers.ts      # 檔案對話框 IPC
│       └── midiDeviceHandlers.ts*   ← Phase 5
├── preload/                     # Context Bridge
│   ├── index.ts
│   └── index.d.ts
├── shared/
│   └── types.ts                 # 跨程序共用型別
└── renderer/src/                # React 前端
    ├── App.tsx
    ├── main.tsx
    ├── assets/main.css
    ├── hooks/
    │   └── useKeyboardShortcuts.ts*    ← Phase 6.5
    ├── engines/
    │   ├── midi/                # MIDI 解析
    │   │   ├── MidiFileParser.ts
    │   │   ├── MidiDeviceManager.ts   ← Phase 5
    │   │   ├── MidiInputParser.ts     ← Phase 5
    │   │   ├── MidiOutputSender.ts    ← Phase 5
    │   │   └── types.ts
    │   ├── fallingNotes/        # 下落音符引擎
    │   │   ├── NoteRenderer.ts
    │   │   ├── ViewportManager.ts
    │   │   ├── keyPositions.ts
    │   │   ├── noteColors.ts
    │   │   └── tickerLoop.ts
    │   ├── audio/               # 音頻引擎 ← Phase 4 ✅
    │   │   ├── AudioEngine.ts
    │   │   ├── SoundFontLoader.ts
    │   │   └── AudioScheduler.ts
    │   ├── practice/*           ← Phase 6
    │   └── metronome/*          ← Phase 6.5
    ├── features/
    │   ├── fallingNotes/        # 下落音符 UI
    │   │   ├── FallingNotesCanvas.tsx
    │   │   ├── PianoKeyboard.tsx
    │   │   └── TransportBar.tsx
    │   ├── midiDevice/          # MIDI 裝置 UI ← Phase 5 ✅
    │   │   ├── DeviceSelector.tsx
    │   │   └── ConnectionStatus.tsx
    │   ├── settings/
    │   │   ├── ThemePicker.tsx
    │   │   └── SettingsPanel.tsx*      ← Phase 6.5
    │   ├── practice/*           ← Phase 6
    │   ├── onboarding/*         ← Phase 6.5
    │   ├── insights/*           ← Phase 6.5
    │   └── sheetMusic/*         ← Phase 7
    ├── stores/
    │   ├── useSongStore.ts
    │   ├── usePlaybackStore.ts
    │   ├── useThemeStore.ts
    │   ├── useMidiDeviceStore.ts      ← Phase 5 ✅
    │   ├── useSettingsStore.ts*       ← Phase 6.5
    │   └── useProgressStore.ts*       ← Phase 6.5
    └── themes/
        └── tokens.ts            # 含 Midnight 主題 ← Phase 6.5
```

> 標有 `*` 的項目為尚未實作的規劃；標有 `✅` 的為已完成

---

## 3. Phase 1 — 專案骨架與 MIDI 解析

**狀態**: ✅ 已完成

### 範圍

- Electron + React + TypeScript + Tailwind 的專案初始化
- electron-vite 建置管線（dev / build / typecheck）
- IPC 檔案對話框：透過系統原生 dialog 選擇 `.mid` 檔案
- MIDI 解析：使用 `@tonejs/midi` 將二進位 MIDI 轉為結構化 `ParsedSong`

### 資料模型

```
ParsedSong
├── fileName: string
├── duration: number (秒)
├── noteCount: number
├── tempos: TempoEvent[]         # { time, bpm }
├── timeSignatures: TimeSignatureEvent[]  # { time, numerator, denominator }
└── tracks: ParsedTrack[]
    ├── name: string
    ├── instrument: string
    ├── channel: number (0-15)
    └── notes: ParsedNote[]      # 依 time 排序
        ├── midi: number (0-127)
        ├── name: string ("C4", "F#5")
        ├── time: number (秒)
        ├── duration: number (秒)
        └── velocity: number (0-127)
```

### 設計決策

- **過濾空軌道**：解析後自動移除沒有音符的軌道，避免 UI 顯示空項目
- **時間單位統一為秒**：`@tonejs/midi` 內部使用 tick，但輸出全部轉為秒，簡化後續所有時間計算
- **IPC 傳 `number[]`**：避免 structured clone 對 `Uint8Array` 的型別遺失問題

---

## 4. Phase 2 — 下落音符引擎

**狀態**: ✅ 已完成

### 範圍

- PixiJS 8 WebGL 渲染引擎
- Sprite 物件池（避免 GC 壓力）
- 時間↔像素座標映射
- 播放控制（Play / Pause / Seek / Reset）
- 琴鍵高亮（hit line 偵測）

### 座標系統

```
┌──────────────────────────────┐ ← y = 0（畫面頂端，未來的音符）
│    ┌──┐                      │
│    │♪ │  ← 音符矩形          │
│    └──┘    x = 琴鍵位置      │
│            y = 由時間計算     │
│            h = 由持續時間計算 │
│                              │
│ ─ ─ ─ ─ hit line ─ ─ ─ ─ ─ │ ← y = canvasHeight（當前播放位置）
├──────────────────────────────┤
│  ▓▓  ▓▓    ▓▓ ▓▓ ▓▓         │ ← PianoKeyboard
└──────────────────────────────┘
```

- **X 軸**：MIDI 音符編號 → 螢幕 x 座標（透過 `keyPositions.ts` 映射 88 鍵佈局）
- **Y 軸**：`screenY = hitLineY - (noteTime - currentTime) × pixelsPerSecond`
- **pixelsPerSecond**：預設 200px/s，控制音符密度（未來可讓使用者調整）

### 渲染管線（每幀）

```
tickerLoop (60 FPS)
  │
  ├─ 1. 讀取 playbackStore.currentTime
  ├─ 2. 若 isPlaying → 推進 currentTime（deltaMS / 1000，上限 0.1s 防跳幀）
  ├─ 3. 計算可見時間範圍 [currentTime, currentTime + windowSeconds]
  ├─ 4. 對每個 track 做 binary search 找出可見音符
  ├─ 5. 更新 sprite 位置（從物件池借出 / 歸還）
  ├─ 6. 偵測 hit line 上的音符（±50ms 寬容窗口）→ 更新 activeNotes
  └─ 7. 通知 React（onActiveNotesChange callback）→ PianoKeyboard 高亮
```

### 物件池設計

NoteRenderer 預先分配 512 個 PixiJS Sprite。每幀維護兩個集合：
- `active`：當前顯示在畫面上的 sprite（key = `trackIndex:noteIndex`）
- `pool`：閒置 sprite 等待重用

當 pool 耗盡時，以 active 數量的 50%（最少 64 個）成長。sprite 離開畫面時歸還 pool。這避免了每幀的 GPU buffer 分配 / 釋放，確保穩定 60 FPS。

### Zustand Store 設計

| Store | 欄位 | 說明 |
|-------|------|------|
| `useSongStore` | `song`, `loadSong()`, `clearSong()` | 當前載入的歌曲 |
| `usePlaybackStore` | `currentTime`, `isPlaying`, `pixelsPerSecond`, setters, `reset()` | 播放狀態 |

PixiJS 透過 `store.getState()` 直接讀取（非 React hook），避免 React re-render。React UI 則用 `useStore(selector)` 訂閱。

---

## 5. Phase 3 — UI 主題系統

**狀態**: ✅ 已完成

### 範圍

- 三套主題色（Lavender / Ocean / Peach）
- CSS Custom Properties 動態切換
- 自訂字型（Nunito + DM Sans + JetBrains Mono）
- Micro-3D 鍵盤樣式（漸層 + 陰影）
- ThemePicker 元件（齒輪圖示 + 色點 popover）

### 主題架構

```
tokens.ts (單一真實來源)
    │
    ├─ useThemeStore (Zustand)
    │   ├─ 讀取 localStorage 恢復上次主題
    │   ├─ applyThemeToDOM() → 設定 :root CSS 變數
    │   └─ hexToPixi() → PixiJS 顏色轉換
    │
    ├─ main.css (@theme 區塊)
    │   └─ 定義 font-display / font-body / font-mono
    │
    └─ 各元件透過 var(--color-*) 引用
```

每個主題定義 20 個色票，涵蓋：背景（bg / surface / surfaceAlt）、文字（text / textMuted）、強調色（accent / accentHover）、邊框（border）、Canvas 相關（canvasBg / gridLine / hitLine / note1~4）、鍵盤（keyActive / keyWhite / keyBlack 等）。

### 字型選擇理由

| 用途 | 字型 | 理由 |
|------|------|------|
| 標題 / Display | Nunito | 圓潤友善，適合兒童取向但不幼稚 |
| 正文 / UI | DM Sans | 比 Inter 更有個性的 Grotesk |
| 等寬 / 時間 | JetBrains Mono | 數字對齊 (tabular-nums)，技術感 |

使用 `@fontsource` 離線打包，避免 CSP 問題和 CDN 依賴。

---

## 6. Phase 4 — 音頻播放

**狀態**: ✅ 已完成（程式碼架構完整，使用合成音色 fallback；真實鋼琴 SoundFont 檔案待 Phase 6.5 補入）

### 目標

讓使用者在觀看下落音符的同時聽到音樂。目前的播放是「靜默」的——音符會移動，但沒有聲音。

### 方案選型

| 方案 | 優點 | 缺點 |
|------|------|------|
| **Web Audio API + SoundFont** | 延遲低、音質好、可離線 | 需載入 SoundFont 檔（~5-20MB） |
| Tone.js Sampler | API 簡潔 | 額外依賴、控制粒度較低 |
| MIDI Output 到外部合成器 | 最真實的音色 | 需要外部裝置或軟體合成器 |

**建議方案**：Web Audio API + SoundFont（如 FluidR3_GM / Musescore General）

### 架構設計

```
engines/audio/
├── AudioEngine.ts        # Web Audio API 封裝
│   ├── init()            # 建立 AudioContext + 載入 SoundFont
│   ├── noteOn(midi, velocity, time)
│   ├── noteOff(midi, time)
│   └── setTempo(bpm)
├── SoundFontLoader.ts    # 解析 SF2 / 管理音色
└── AudioScheduler.ts     # 預排程音符（look-ahead scheduling）
```

### 同步策略

Phase 2 使用 `requestAnimationFrame` 推進時間。Phase 4 需改用 `AudioContext.currentTime` 作為時間基準，理由：

- `rAF` 在背景分頁會暫停或降速，導致音畫不同步
- `AudioContext.currentTime` 是硬體時鐘驅動，精度為微秒級

**同步流程**：
1. 使用者按下 Play → 記錄 `startAudioTime = audioContext.currentTime`
2. 每幀的 `currentTime = audioContext.currentTime - startAudioTime + seekOffset`
3. AudioScheduler 使用 look-ahead（預先排程 100ms 內的音符到 Web Audio API）
4. 視覺引擎讀取同一個 `currentTime` 渲染畫面

### SoundFont 策略

- 預設內建一個輕量鋼琴 SoundFont（約 5MB），打包在 app 內
- 進階使用者可在設定中載入自訂 `.sf2` 檔案
- 資源存放於 Electron 的 `resources/` 目錄，透過 IPC 讀取

### 相依變更

- `usePlaybackStore` 新增：`audioContext`, `startAudioTime`, `seekOffset`
- `tickerLoop.ts`：時間來源從 `deltaMS` 改為 `AudioContext.currentTime`
- `TransportBar`：Play 按鈕需觸發 `AudioContext.resume()`（瀏覽器自動暫停政策）

---

## 7. Phase 5 — MIDI 裝置連接

**狀態**: ✅ 已完成（MidiDeviceManager / MidiInputParser / MidiOutputSender + DeviceSelector / ConnectionStatus UI）

### 目標

連接實體 MIDI 鍵盤（USB 或藍牙），讓使用者：
- **輸入**：彈奏時即時在畫面上顯示按鍵、用於練習模式評分
- **輸出**：將歌曲的 MIDI 訊號傳送到外部音源（如 Roland 鋼琴的喇叭）

### 技術方案：Web MIDI API

Chromium（Electron 內核）原生支援 `navigator.requestMIDIAccess()`。作業系統配對藍牙 MIDI 裝置後，它會被虛擬化為標準 MIDI Port，應用程式不需要處理底層 BLE GATT 協定。

```
作業系統 (BLE 配對)  →  虛擬 MIDI Port  →  Web MIDI API  →  Rexiano
```

### 平台差異

| 平台 | 藍牙 MIDI 支援 |
|------|----------------|
| **macOS** | 原生支援 BLE MIDI，配對後 Chrome/Electron 直接可見 |
| **Linux** | 需透過 BlueZ 配對，通常正常運作 |
| **Windows** | 傳統 Win32 API 對 BLE MIDI 支援較弱，可能需要使用者安裝 [MIDIberry](https://www.microsoft.com/store/apps/9n39720h2m05) 或 KORG BLE-MIDI Driver 作為橋接 |

> Windows BLE MIDI 的限制需在 README 中明確說明，並提供安裝指引。

### 架構設計

```
stores/useMidiDeviceStore.ts
├── inputs: MIDIInput[]           # 可用的輸入裝置
├── outputs: MIDIOutput[]         # 可用的輸出裝置
├── selectedInput: string | null  # 選中的輸入裝置 ID
├── selectedOutput: string | null
├── isConnected: boolean
├── connect()                     # requestMIDIAccess + 監聽
└── disconnect()

features/settings/MidiDevicePanel.tsx
├── 裝置列表（下拉選單）
├── 連線狀態指示燈
├── 測試按鈕（彈一個音確認連線）
└── 自動重連邏輯
```

### MIDI 訊息處理

Web MIDI API 的 `onmidimessage` 回傳 3 bytes：`[command, note, velocity]`

| Command | 意義 |
|---------|------|
| `0x90` (144) | Note On（velocity > 0） |
| `0x80` (128) | Note Off |
| `0xB0` (176) | Control Change（踏板等） |

收到 Note On 時：
1. 更新 `activeNotes`（即時鍵盤高亮）
2. 若在練習模式 → 送入評分引擎比對
3. 若有選中 Output → 可選擇性轉發（thru 模式）

### MIDI Output 用途

- 將歌曲的音符以 MIDI 訊號送到外部鍵盤的喇叭播放
- 實現「示範模式」：鋼琴自動彈奏讓孩子觀看

---

## 8. Phase 6 — 練習模式

**狀態**: 🔄 實作中（Agent Team 進行中）

### 目標

這是 Rexiano 的核心教育功能。讓使用者透過互動式練習學習彈奏鋼琴曲目。

### 練習模式類型

#### 8.1 自由觀看模式（Watch Mode）

即目前已實作的功能——播放歌曲、觀看下落音符。Phase 4 完成後會有聲音。

#### 8.2 等待模式（Wait Mode）

最重要的練習模式。歌曲會在每個音符處暫停，等待使用者在鍵盤上彈出正確的音後才繼續。

**流程**：
```
播放中 → 遇到下一個音符 → 暫停播放
                              │
              使用者彈對了 ← ─ ┤
              │                 │
              繼續播放          使用者彈錯了
                                │
                              視覺提示（閃爍正確的鍵）
```

**設計細節**：
- 容許時間窗口：音符到達 hit line 前後 ±200ms 內按下均算正確
- 多音同時（和弦）：需所有音符都被按下才繼續
- 可設定「僅右手」或「僅左手」（依 track 過濾）

#### 8.3 速度控制

- 播放速度：25% / 50% / 75% / 100%（調整 `pixelsPerSecond` 與音頻播放速率）
- 速度不影響音高（使用 Web Audio API 的 `playbackRate` + pitch correction，或簡單調整排程間隔）

#### 8.4 段落循環（Loop Section）

- 使用者在 seek bar 上拖曳選取一段範圍（A-B 點）
- 播放到 B 點後自動跳回 A 點重複
- UI：seek bar 上顯示彩色高亮區段

#### 8.5 分手練習

- 可選擇只顯示 / 只評分特定 track（通常 Track 1 = 右手, Track 2 = 左手）
- 被隱藏的 track 仍然播放音頻（作為伴奏），但不要求使用者彈奏

### 評分系統

```
stores/usePracticeStore.ts
├── mode: 'watch' | 'wait' | 'free'
├── speed: number (0.25 ~ 2.0)
├── loopRange: [number, number] | null
├── activeTracks: Set<number>      # 哪些 track 需要練習
├── score: PracticeScore
│   ├── totalNotes: number
│   ├── hitNotes: number
│   ├── missedNotes: number
│   ├── accuracy: number (%)
│   └── streaks: number            # 連續正確數
└── noteResults: Map<string, 'hit' | 'miss' | 'pending'>
```

### 視覺回饋

| 狀態 | 視覺效果 |
|------|----------|
| 音符即將到達 | 正常顯示（track 顏色） |
| 命中（Hit） | 短暫發光 + 粒子效果 |
| 錯過（Miss） | 轉為半透明灰色 + 鍵盤閃爍正確按鍵 |
| 評分面板 | 練習結束後顯示準確率、連擊數、建議 |

---

## 9. Phase 6.5 — 兒童可用性增強

**狀態**: 🔲 未開始（依賴 Phase 6 完成後啟動）

### 目標

Phase 6 完成後，Rexiano 已具備練習模式引擎，但離「6 歲兒童打開軟體就能自己練琴」仍有明顯缺口。Phase 6.5 的目標是填補這些缺口，使 Rex 能獨立坐下來練琴，並在多項功能上對標甚至超越 Synthesia。

本 Phase 分為 5 個 Sprint，依序遞進。

---

### 9.1 琴鍵音名標籤

**問題**：88 鍵鋼琴上，初學者無法快速辨識每個琴鍵的音名。

**設計**：

```
┌──────────────────────────────────────────┐
│  C4   D4   E4   F4   G4   A4   B4       │  ← 白鍵上方顯示音名
│ ▓C#4▓ ▓D#4▓    ▓F#4▓ ▓G#4▓ ▓A#4▓       │  ← 黑鍵下方顯示音名
└──────────────────────────────────────────┘
```

- **MIDI → 音名映射**：`midiToNoteName(midi: number): string`，輸出格式 `C4`, `F#5`（與 ParsedNote.name 一致）
- **位置**：白鍵標籤置於鍵底部居中；黑鍵標籤置於鍵下方居中
- **字型**：JetBrains Mono 10px，半透明（`opacity: 0.6`），避免視覺干擾
- **可開關**：透過 `useSettingsStore.showNoteLabels`（預設 `true`）
- **效能**：純 CSS/React 渲染（非 Canvas），僅 88 個 DOM 元素，無效能疑慮

### 9.2 下落音符音名標籤

**問題**：下落音符僅以顏色區分左右手，初學者無法快速辨識每個音符的音名。

**設計**：

- **渲染方式**：PixiJS `BitmapText`，使用預先生成的 BitmapFont（JetBrains Mono 12px bold white）
- **物件池**：與 Sprite 物件池平行管理一個 BitmapText pool（初始 256 個），共享 acquire/release 生命週期
- **位置**：音名文字置於音符矩形內部，垂直居中、水平居中
- **最小高度閾值**：若音符矩形高度 < 16px（短音符），不顯示音名以避免文字溢出
- **可開關**：透過 `useSettingsStore.showFallingNoteLabels`（預設 `true`）
- **效能考量**：
  - BitmapText 比 PIXI.Text 快 10 倍以上（無 Canvas 2D 開銷）
  - 同畫面最多約 100 個可見音符，256 pool 足夠
  - 字型 atlas 僅需 `0-9`, `A-G`, `#`, `b` 等少量字元，記憶體 < 50KB

### 9.3 鍵盤快捷鍵

**問題**：目前所有操作僅能透過滑鼠點擊，不利於練琴時快速操作。

**對照表**：

| 快捷鍵 | 功能 | 說明 |
|---------|------|------|
| `Space` | 播放 / 暫停 | 最常用操作 |
| `R` | 重置到開頭 | 重新練習 |
| `←` / `→` | 快退 / 快進 5 秒 | Seek |
| `Shift + ←` / `Shift + →` | 快退 / 快進 15 秒 | 大幅 Seek |
| `↑` / `↓` | 加速 / 減速 25% | 速度微調 |
| `L` | 切換段落循環 | 設定 / 取消 A-B 循環 |
| `1` / `2` / `3` | 切換練習模式 | Watch / Wait / Free |
| `M` | 靜音切換 | 音頻開關 |
| `Ctrl+O` / `Cmd+O` | 開啟 MIDI 檔案 | 檔案匯入 |
| `?` | 顯示快捷鍵說明 | Help overlay |

**實作**：

```
hooks/useKeyboardShortcuts.ts
├── useEffect → window.addEventListener('keydown', handler)
├── 依據 e.key 分發到對應 store action
├── 防止與 input/textarea 衝突（e.target 檢查）
└── 清理：useEffect cleanup 移除 listener
```

### 9.4 暗色主題「Midnight」

**問題**：目前三套主題（Lavender / Ocean / Peach）均為淺色系，夜間練琴刺眼。

**色票設計**：

```typescript
// tokens.ts 新增 Midnight 主題
midnight: {
  bg:          '#0f0f14',    // 深灰近黑
  surface:     '#1a1a24',    // 卡片背景
  surfaceAlt:  '#24243a',    // 交替行
  text:        '#e8e6f0',    // 主文字
  textMuted:   '#8888a0',    // 次要文字
  accent:      '#7c6ef0',    // 紫藍強調
  accentHover: '#9b8fff',    // 強調 hover
  border:      '#2e2e44',    // 邊框
  canvasBg:    '#0a0a10',    // Canvas 背景（最深）
  gridLine:    '#1e1e30',    // 網格線
  hitLine:     '#ff6b6b',    // Hit line（紅色高亮）
  note1:       '#7c6ef0',    // Track 1 音符
  note2:       '#ff6b9d',    // Track 2 音符
  note3:       '#4ecdc4',    // Track 3 音符
  note4:       '#ffe66d',    // Track 4 音符
  keyWhite:    '#1e1e2e',    // 白鍵（深色）
  keyBlack:    '#0a0a14',    // 黑鍵（最深）
  keyActive:   '#7c6ef0',    // 按下的鍵（跟隨 accent）
  keyBorder:   '#2e2e44',    // 鍵盤邊框
  keyWhiteGrad: ['#1e1e2e', '#16162a'],  // 白鍵漸層
  keyBlackGrad: ['#0a0a14', '#060610'],  // 黑鍵漸層
}
```

- 加入 `tokens.ts` 的 `themes` 物件，與現有三套主題並列
- ThemePicker 新增第四個色點（深灰 + 月亮圖示）
- 所有 UI 元件已透過 `var(--color-*)` 引用，無需逐一修改

### 9.5 設定面板

**問題**：多項設定（音名開關、快捷鍵、主題等）需要一個集中的 UI 介面。

**Store 設計**：

```typescript
// stores/useSettingsStore.ts
interface SettingsState {
  // 顯示
  showNoteLabels: boolean          // 琴鍵音名（預設 true）
  showFallingNoteLabels: boolean   // 下落音符音名（預設 true）

  // 音頻
  volume: number                   // 0-100（預設 80）
  muted: boolean                   // 靜音（預設 false）

  // 練習
  defaultSpeed: number             // 預設速度 0.25-2.0（預設 1.0）
  defaultMode: PracticeMode        // 預設練習模式（預設 'watch'）

  // 進階
  metronomeEnabled: boolean        // 節拍器（預設 false）
  countInBeats: number             // 預備拍數（預設 4）

  // 持久化
  // → localStorage 自動同步（與 themeStore 同模式）
}
```

**UI 設計**：

```
┌─────────────────────────────────┐
│  ⚙ 設定                    ✕   │
├─────────────────────────────────┤
│                                 │
│  顯示                           │
│  ┌──────────────────────────┐   │
│  │ 琴鍵音名      [✓] 開啟  │   │
│  │ 音符音名      [✓] 開啟  │   │
│  └──────────────────────────┘   │
│                                 │
│  音頻                           │
│  ┌──────────────────────────┐   │
│  │ 音量      ────●───── 80% │   │
│  │ 靜音          [ ] 關閉   │   │
│  └──────────────────────────┘   │
│                                 │
│  練習                           │
│  ┌──────────────────────────┐   │
│  │ 預設速度   ──●──── 100%  │   │
│  │ 預設模式   [觀看 ▾]      │   │
│  │ 節拍器        [ ] 關閉   │   │
│  │ 預備拍       [4 ▾]       │   │
│  └──────────────────────────┘   │
│                                 │
│  主題                           │
│  ● Lavender ● Ocean            │
│  ● Peach    ● Midnight          │
│                                 │
└─────────────────────────────────┘
```

- 使用 Modal / Drawer 呈現，從 TransportBar 的齒輪圖示觸發
- 取代現有的 ThemePicker popover（升級為完整設定面板）

### 9.6 成績持久化

**問題**：練習結束後的成績無法保存，使用者無法追蹤進步。

**資料模型**：

```typescript
// shared/types.ts 新增
interface SessionRecord {
  id: string                      // UUID
  songId: string                  // BuiltinSongMeta.id 或 fileName hash
  songTitle: string               // 冗餘存儲，方便顯示
  timestamp: number               // Unix timestamp (ms)
  mode: PracticeMode              // 練習模式
  speed: number                   // 練習速度
  score: PracticeScore            // 複用已有型別
  durationSeconds: number         // 練習時長
  tracksPlayed: number[]          // 練習的 track indices
}
```

**存儲方案**：

```
stores/useProgressStore.ts
├── sessions: SessionRecord[]             // 所有歷史記錄
├── addSession(record: SessionRecord)     // 新增
├── getSessionsBySong(songId: string)     // 按歌曲查詢
├── getRecentSessions(limit: number)      // 最近 N 筆
├── getBestScore(songId: string)          // 最佳成績
└── 持久化：electron-store 或 localStorage
    → JSON 檔案存於 app.getPath('userData')/progress.json
```

**IPC channels**（新增於 `IpcChannels`）：

```typescript
SAVE_SESSION: 'progress:saveSession',
LOAD_SESSIONS: 'progress:loadSessions',
```

### 9.7 拖放匯入

**問題**：目前匯入 MIDI 檔案只能透過選單的「開啟檔案」對話框，不夠直覺。

**設計**：

- 在 `App.tsx` 頂層監聽 `onDragOver` / `onDrop` 事件
- 拖放區域覆蓋整個視窗
- 拖入時顯示半透明 overlay：「拖放 .mid 檔案到此處」
- 驗證副檔名（`.mid`, `.midi`），非法格式顯示錯誤提示
- 成功後呼叫 `useSongStore.loadSong()` 走現有流程

### 9.8 BPM 顯示與難度說明

- **BPM**：在 TransportBar 顯示當前 tempo（從 `ParsedSong.tempos[0].bpm` 讀取）
- **難度**：曲庫中的歌曲顯示 BuiltinSongMeta.difficulty，搭配圖示（⭐ / ⭐⭐ / ⭐⭐⭐）

### 9.9 慶祝效果與結算畫面

**問題**：練習結束時缺乏正面回饋，對兒童使用者尤為重要。

**設計**：

- **練習結束**時，根據 accuracy 顯示不同等級的慶祝動畫：
  - `accuracy ≥ 90%`：全屏 confetti 粒子 + 「太棒了！🎉」
  - `accuracy ≥ 70%`：星星粒子 + 「做得好！⭐」
  - `accuracy < 70%`：鼓勵文字 + 「再試一次？」
- **結算畫面**：Modal 顯示 PracticeScore 詳細數據 + 歷史最佳對比 + 「重新練習」/「換首歌」按鈕
- 粒子效果使用 PixiJS ParticleContainer（與 Canvas 共用 stage）

### 9.10 最近檔案

- 記錄最近開啟的 10 個 MIDI 檔案路徑 + 檔名
- 儲存於 `localStorage` 或 `electron-store`
- UI：在匯入對話框或主畫面顯示「最近開啟」清單

### 9.11 視覺節拍器

**設計**：

- 在 Canvas 上方或 TransportBar 下方顯示閃爍的節拍指示
- 每拍閃爍一次（強拍更明顯），使用 CSS animation 或 PixiJS
- 可選音頻節拍器（Web Audio API 產生 click 音）
- 透過 `useSettingsStore.metronomeEnabled` 控制

### 9.12 新手引導（Onboarding）

- 首次啟動時顯示 3-5 步引導 overlay
- 步驟：1) 匯入 MIDI 檔案 → 2) 按 Space 播放 → 3) 選擇練習模式 → 4) 連接鍵盤（可選）
- 使用 `localStorage` 記錄 `onboardingCompleted` 避免重複顯示
- UI：半透明背景 + 高亮目標元素 + 文字說明 + 下一步按鈕

### 9.13 指法建議（長期）

**概述**：

根據音符序列自動推薦指法，降低初學者的認知負擔。

**演算法**：

- 基於規則的啟發式演算法（非 ML）：
  1. 音階模式偵測 → 套用標準指法模板（如 C 大調音階 1-2-3-1-2-3-4-5）
  2. 跳躍距離計算 → 指距表（每根手指可舒適延伸的半音數）
  3. 拇指穿越規則 → 拇指只在 1→3 或 1→4 之後穿越
  4. 和弦指法 → 根據音程組合查表
- 顯示方式：在下落音符或琴鍵旁以小數字 (1-5) 標示
- 資料：指法結果快取在 `ParsedNote` 擴充欄位中

### 9.14 練習洞察分析（長期）

**設計**：

```
features/insights/
├── InsightsPanel.tsx          # 分析面板 UI
├── ProgressChart.tsx          # accuracy 隨時間的折線圖
└── WeakSpotAnalyzer.ts        # 分析弱點

分析維度：
├── 時間趨勢：每首歌的 accuracy 隨練習次數的變化
├── 弱點分析：最常 miss 的音符 / 段落
├── 練習時長統計：每日 / 每週練習時間
└── 里程碑：首次通關、首次 90%+ 等成就
```

- 資料來源：`useProgressStore.sessions`
- 圖表：使用輕量 SVG 或 CSS 自繪（避免引入 Chart.js 等重型函式庫）

### 9.15 中文 UI（長期）

- i18n 框架：`react-i18next` 或自建輕量 key-value map
- 預設語言跟隨系統 `navigator.language`
- 初期僅支援 `zh-TW` 和 `en`
- 翻譯檔案放在 `src/renderer/src/locales/`

---

### Phase 6.5 新增檔案架構

```
src/renderer/src/
├── hooks/
│   └── useKeyboardShortcuts.ts     ← 全域鍵盤快捷鍵
├── stores/
│   ├── useSettingsStore.ts         ← 設定狀態
│   └── useProgressStore.ts         ← 成績持久化
├── features/
│   ├── settings/
│   │   └── SettingsPanel.tsx       ← 設定面板（取代 ThemePicker）
│   ├── practice/
│   │   └── CelebrationOverlay.tsx  ← 慶祝效果
│   ├── onboarding/
│   │   └── OnboardingGuide.tsx     ← 新手引導
│   └── insights/
│       ├── InsightsPanel.tsx        ← 練習洞察
│       └── ProgressChart.tsx        ← 進度圖表
├── engines/
│   └── metronome/
│       └── MetronomeEngine.ts       ← 節拍器引擎
└── themes/
    └── tokens.ts                    ← 新增 Midnight 主題色票
```

---

## 10. Phase 7 — 樂譜顯示

**狀態**: 🔲 未開始

### 目標

在下落音符視圖之外，提供傳統五線譜顯示，讓使用者可以邊看譜邊練習。

### 方案選型

| 方案 | 優點 | 缺點 |
|------|------|------|
| **VexFlow** | 輕量、API 靈活、可自訂渲染 | 需自行處理 MIDI → 樂譜的轉換 |
| OSMD (OpenSheetMusicDisplay) | 直接讀取 MusicXML、排版完善 | 較重、自訂空間較小 |
| abcjs | 極輕量 | ABC notation 小眾，需額外轉換 |

**建議方案**：先用 VexFlow，因為我們的核心資料是 MIDI，需要自行控制「MIDI 音符 → 五線譜音符」的映射。OSMD 更適合已有 MusicXML 的場景。

### 架構設計

```
features/sheetMusic/
├── SheetMusicPanel.tsx       # React 元件，嵌入 VexFlow 渲染
├── MidiToNotation.ts         # MIDI ParsedNote[] → VexFlow StaveNote[]
│   ├── 量化（quantize）：將浮點秒數對齊到最近的節拍格線
│   ├── 音符分組：依小節線切割
│   ├── 符桿方向：依音高決定
│   └── 調號 / 拍號推斷
└── CursorSync.ts             # 同步下落音符的 currentTime 到譜面游標位置
```

### 顯示模式

```
┌──────────────────────────────────────┐
│  模式 A：上下分割                      │
│  ┌──────────────────────────────────┐│
│  │     🎵 五線譜（游標跟隨）        ││
│  ├──────────────────────────────────┤│
│  │     ⬇ 下落音符                   ││
│  ├──────────────────────────────────┤│
│  │     🎹 鍵盤                      ││
│  └──────────────────────────────────┘│
│                                      │
│  模式 B：僅五線譜（傳統練習）          │
│  ┌──────────────────────────────────┐│
│  │     🎵 五線譜（全屏，游標跟隨）   ││
│  ├──────────────────────────────────┤│
│  │     🎹 鍵盤                      ││
│  └──────────────────────────────────┘│
│                                      │
│  模式 C：僅下落音符（目前預設）        │
└──────────────────────────────────────┘
```

### MIDI → 五線譜的挑戰

MIDI 本質上是「演奏資料」而非「樂譜資料」，轉換時需處理：

1. **量化 (Quantization)**：演奏時間不完美，需對齊到最近的 16 分音符格線
2. **音符時值推斷**：MIDI 只有 duration（秒），需根據 tempo 反推是四分音符還是八分音符
3. **休止符插入**：MIDI 中沒有明確的休止符，需從音符間隙推斷
4. **譜號分配**：通常以 Middle C (MIDI 60) 為界，上方高音譜號、下方低音譜號
5. **連結線 / 附點**：跨小節的音符需用連結線表示

> 這是整個專案中技術難度最高的部分。初期可只支援基本的單音旋律顯示，和弦與複雜節奏型態逐步完善。

---

## 11. Phase 8 — 樂譜編輯

**狀態**: 🔲 未開始（Extra 功能）

### 目標

讓使用者在 Rexiano 內直接建立或編輯 MIDI 檔案，無需仰賴外部軟體。

### 功能範圍

#### 最小可行版（MVP）
- Piano Roll 編輯器：在格線上點擊新增 / 拖曳調整 / 刪除音符
- 基本屬性編輯：音符長度、力度
- 匯出為 `.mid` 檔案

#### 進階功能
- 多軌編輯
- 拍號 / 調號設定
- 複製 / 貼上 / 量化
- Undo / Redo（command pattern）
- MusicXML 匯入 / 匯出

### 架構設計

```
features/editor/
├── PianoRollEditor.tsx     # 核心編輯 Canvas（可複用 PixiJS 或獨立 Canvas）
├── EditorToolbar.tsx       # 工具列（選取、繪製、刪除、量化）
├── NoteInspector.tsx       # 右側面板：選中音符的屬性編輯
└── EditorCommands.ts       # Undo/Redo command stack

stores/useEditorStore.ts
├── notes: EditableNote[]
├── selectedNotes: Set<string>
├── tool: 'select' | 'draw' | 'erase'
├── gridSnap: number (以 tick 為單位)
├── undoStack / redoStack
├── addNote() / deleteNote() / moveNote() / resizeNote()
└── exportMidi() → Uint8Array
```

---

## 12. Phase 9 — 打包與發佈

**狀態**: 🔲 未開始（部分配置已就緒）

### 目前狀態

`electron-builder.yml` 已配置基本的 Win / Mac / Linux 打包設定。但尚缺：

### 待完成項目

#### 12.1 自動化建置 (CI/CD)

```yaml
# .github/workflows/release.yml 概念
trigger: tag push (v*)
jobs:
  - build-windows:  pnpm build:win   → .exe / .msi
  - build-mac:      pnpm build:mac   → .dmg
  - build-linux:    pnpm build:linux  → .AppImage / .deb / .snap
  - create-release: 上傳 artifacts 到 GitHub Release
```

#### 12.2 自動更新

- 整合 `electron-updater`
- 發佈到 GitHub Releases
- 應用內提示更新（非強制）

#### 12.3 程式碼簽章

| 平台 | 需求 |
|------|------|
| Windows | EV Code Signing Certificate（否則 SmartScreen 警告） |
| macOS | Apple Developer 帳號 + notarization |
| Linux | 無強制要求 |

> 初期可暫不簽章，但 README 需提醒使用者 SmartScreen / Gatekeeper 的處理方式。

#### 12.4 安裝體驗

- Windows：NSIS 安裝程式，桌面捷徑，檔案關聯 `.mid`
- macOS：DMG 拖放安裝
- Linux：AppImage（免安裝）+ deb / snap

---

## 13. Synthesia 功能對照

下表比較 Rexiano 與 Synthesia 的功能覆蓋，標示目前狀態與規劃 Phase。

| 功能 | Synthesia | Rexiano | 狀態 | Phase |
|------|-----------|---------|------|-------|
| MIDI 匯入 | ✅ | ✅ | 已完成 | 1 |
| 下落音符 | ✅ | ✅ | 已完成 | 2 |
| 音頻播放 | ✅ 鋼琴音色 | ⚠️ 合成音色 | SF2 待補 | 4 → 6.5 |
| MIDI 裝置連接 | ✅ | ✅ | 已完成 | 5 |
| 等待模式 | ✅ | 🔄 | 實作中 | 6 |
| 速度控制 | ✅ | 🔄 | 實作中 | 6 |
| 段落循環 | ✅ | 🔄 | 實作中 | 6 |
| 分手練習 | ✅ | 🔄 | 實作中 | 6 |
| 評分系統 | ✅ | 🔄 | 實作中 | 6 |
| 琴鍵音名 | ✅ | 🔲 | 規劃 | 6.5 |
| 下落音符音名 | ✅ | 🔲 | 規劃 | 6.5 |
| 鍵盤快捷鍵 | ✅ | 🔲 | 規劃 | 6.5 |
| 暗色主題 | ❌ 僅 2 色 | 🔲 Midnight | 規劃 | 6.5 |
| 拖放匯入 | ✅ | 🔲 | 規劃 | 6.5 |
| 成績持久化 | ✅ 進度追蹤 | 🔲 | 規劃 | 6.5 |
| 慶祝效果 | ✅ 星星+掌聲 | 🔲 | 規劃 | 6.5 |
| 新手引導 | ✅ | 🔲 | 規劃 | 6.5 |
| 節拍器 | ✅ | 🔲 | 規劃 | 6.5 |
| 指法建議 | ✅ | 🔲 | 規劃（長期） | 6.5 |
| 五線譜顯示 | ❌ | 🔲 | 規劃 | 7 |
| 樂譜編輯 | ❌ | 🔲 | 規劃 | 8 |
| 多主題 | ❌ 僅 2 色 | ✅ 4 套 | 已完成 | 3 + 6.5 |
| 開源免費 | ❌ $40 | ✅ | — | — |
| 中文 UI | ❌ | 🔲 | 規劃（長期） | 6.5 |

**Rexiano 的差異化優勢**：
- **五線譜顯示**（Phase 7）：Synthesia 不支援，Rexiano 將成為唯一結合下落音符與五線譜的開源工具
- **多主題系統**：4 套精心設計的主題（含暗色），Synthesia 僅有固定配色
- **開源免費**：Synthesia 售價 $40，Rexiano 完全開源
- **中文 UI**：Synthesia 無中文介面

---

## 14. 跨領域關注點

### 14.1 效能

| 項目 | 目標 | 策略 |
|------|------|------|
| 渲染幀率 | 穩定 60 FPS | PixiJS sprite pool、binary search 裁剪 |
| 記憶體 | < 200MB | sprite 歸還 pool、避免大量 GC |
| 啟動時間 | < 3 秒 | 延遲載入 SoundFont、code splitting |
| MIDI 解析 | < 500ms | @tonejs/midi 已足夠快 |

### 14.2 無障礙 (Accessibility)

- 鍵盤快捷鍵：→ 見 Phase 6.5 §9.3 完整對照表
- 暗色主題「Midnight」：→ 見 Phase 6.5 §9.4
- 螢幕閱讀器：transport bar 的 ARIA labels

### 14.3 國際化 (i18n)

- 初期英文 UI，中文 UI 規劃於 Phase 6.5 Sprint 5
- → 見 Phase 6.5 §9.15 中文 UI 設計

### 14.4 測試策略

| 層級 | 範圍 | 工具 |
|------|------|------|
| 單元測試 | 引擎邏輯（NoteRenderer, ViewportManager, keyPositions） | Vitest |
| 元件測試 | React 元件渲染與互動 | Vitest + Testing Library |
| E2E 測試 | 載入 MIDI → 播放 → 鍵盤高亮 完整流程 | Playwright (未來) |

### 14.5 安全性

- CSP (Content Security Policy) 在 `index.html` 中限制資源來源
- `sandbox: false` 是因為需要 preload script 存取 Node API，但 renderer 仍受 contextBridge 隔離
- 不執行任何使用者提供的程式碼（MIDI 是資料格式，非可執行格式）

---

## Phase 依賴關係

```
Phase 1 (MIDI 解析) ✅
    │
Phase 2 (下落音符引擎) ✅
    │
Phase 3 (UI 主題) ✅
    │
    ├─── Phase 4 (音頻播放) ✅
    │        │
    │        ├─── Phase 5 (MIDI 裝置) ✅
    │        │        │
    │        │        └─── Phase 6 (練習模式) 🔄
    │        │                 │
    │        │                 └─── Phase 6.5 (兒童可用性增強)
    │        │                      ├─ Sprint 1: 無依賴（快捷鍵/音名/SF2/暗色主題）
    │        │                      ├─ Sprint 2: 依賴 Phase 6（練習面板整合/慶祝效果）
    │        │                      ├─ Sprint 3: 依賴 Sprint 2（成績持久化/設定面板）
    │        │                      ├─ Sprint 4: 可平行（節拍器/新手引導/擴充曲庫）
    │        │                      └─ Sprint 5: 長期（指法/洞察/中文 UI）
    │        │
    │        └─── Phase 7 (樂譜顯示)
    │                 │
    │                 └─── Phase 8 (樂譜編輯) [Extra]
    │
    └─── Phase 9 (打包發佈) ← 可與 Phase 4-8 並行
```

- Phase 1-5 已全部完成
- Phase 6 實作中（Agent Team 進行中）
- Phase 6.5 Sprint 1 可與 Phase 6 平行啟動（不依賴練習模式引擎）
- Phase 6.5 Sprint 2-3 依序遞進，Sprint 4 可平行，Sprint 5 為長期規劃
- Phase 7 和 Phase 6.5 互不依賴，可平行開發
- Phase 9 可隨時進行
