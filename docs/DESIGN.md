# Rexiano — 系統設計文件

> **版本**: 1.0
> **日期**: 2026-02-26
> **狀態**: 草稿

---

## 目錄

1. [專案願景](#1-專案願景)
2. [技術架構總覽](#2-技術架構總覽)
3. [Phase 1 — 專案骨架與 MIDI 解析（已完成）](#3-phase-1--專案骨架與-midi-解析)
4. [Phase 2 — 下落音符引擎（已完成）](#4-phase-2--下落音符引擎)
5. [Phase 3 — UI 主題系統（已完成）](#5-phase-3--ui-主題系統)
6. [Phase 4 — 音頻播放](#6-phase-4--音頻播放)
7. [Phase 5 — MIDI 裝置連接](#7-phase-5--midi-裝置連接)
8. [Phase 6 — 練習模式](#8-phase-6--練習模式)
9. [Phase 7 — 樂譜顯示](#9-phase-7--樂譜顯示)
10. [Phase 8 — 樂譜編輯（Extra）](#10-phase-8--樂譜編輯)
11. [Phase 9 — 打包與發佈](#11-phase-9--打包與發佈)
12. [跨領域關注點](#12-跨領域關注點)

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
    ├── engines/
    │   ├── midi/                # MIDI 解析
    │   │   ├── MidiFileParser.ts
    │   │   └── types.ts
    │   ├── fallingNotes/        # 下落音符引擎
    │   │   ├── NoteRenderer.ts
    │   │   ├── ViewportManager.ts
    │   │   ├── keyPositions.ts
    │   │   ├── noteColors.ts
    │   │   └── tickerLoop.ts
    │   └── audio/*              ← Phase 4
    ├── features/
    │   ├── fallingNotes/        # 下落音符 UI
    │   │   ├── FallingNotesCanvas.tsx
    │   │   ├── PianoKeyboard.tsx
    │   │   └── TransportBar.tsx
    │   ├── settings/
    │   │   └── ThemePicker.tsx
    │   ├── practice/*           ← Phase 6
    │   └── sheetMusic/*         ← Phase 7
    ├── stores/
    │   ├── useSongStore.ts
    │   ├── usePlaybackStore.ts
    │   ├── useThemeStore.ts
    │   └── useMidiDeviceStore.ts*   ← Phase 5
    └── themes/
        └── tokens.ts
```

> 標有 `*` 的項目為尚未實作的規劃

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

**狀態**: 🔲 未開始

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

**狀態**: 🔲 未開始

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

**狀態**: 🔲 未開始

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

## 9. Phase 7 — 樂譜顯示

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

## 10. Phase 8 — 樂譜編輯

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

## 11. Phase 9 — 打包與發佈

**狀態**: 🔲 未開始（部分配置已就緒）

### 目前狀態

`electron-builder.yml` 已配置基本的 Win / Mac / Linux 打包設定。但尚缺：

### 待完成項目

#### 11.1 自動化建置 (CI/CD)

```yaml
# .github/workflows/release.yml 概念
trigger: tag push (v*)
jobs:
  - build-windows:  pnpm build:win   → .exe / .msi
  - build-mac:      pnpm build:mac   → .dmg
  - build-linux:    pnpm build:linux  → .AppImage / .deb / .snap
  - create-release: 上傳 artifacts 到 GitHub Release
```

#### 11.2 自動更新

- 整合 `electron-updater`
- 發佈到 GitHub Releases
- 應用內提示更新（非強制）

#### 11.3 程式碼簽章

| 平台 | 需求 |
|------|------|
| Windows | EV Code Signing Certificate（否則 SmartScreen 警告） |
| macOS | Apple Developer 帳號 + notarization |
| Linux | 無強制要求 |

> 初期可暫不簽章，但 README 需提醒使用者 SmartScreen / Gatekeeper 的處理方式。

#### 11.4 安裝體驗

- Windows：NSIS 安裝程式，桌面捷徑，檔案關聯 `.mid`
- macOS：DMG 拖放安裝
- Linux：AppImage（免安裝）+ deb / snap

---

## 12. 跨領域關注點

### 12.1 效能

| 項目 | 目標 | 策略 |
|------|------|------|
| 渲染幀率 | 穩定 60 FPS | PixiJS sprite pool、binary search 裁剪 |
| 記憶體 | < 200MB | sprite 歸還 pool、避免大量 GC |
| 啟動時間 | < 3 秒 | 延遲載入 SoundFont、code splitting |
| MIDI 解析 | < 500ms | @tonejs/midi 已足夠快 |

### 12.2 無障礙 (Accessibility)

- 鍵盤快捷鍵：Space = Play/Pause, R = Reset, ← → = Seek
- 高對比模式（可在未來新增 Dark 主題）
- 螢幕閱讀器：transport bar 的 ARIA labels

### 12.3 國際化 (i18n)

- 初期僅英文 UI
- 架構上預留 i18n key（但不過早實作）
- 中文翻譯作為第一個社群貢獻目標

### 12.4 測試策略

| 層級 | 範圍 | 工具 |
|------|------|------|
| 單元測試 | 引擎邏輯（NoteRenderer, ViewportManager, keyPositions） | Vitest |
| 元件測試 | React 元件渲染與互動 | Vitest + Testing Library |
| E2E 測試 | 載入 MIDI → 播放 → 鍵盤高亮 完整流程 | Playwright (未來) |

### 12.5 安全性

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
    ├─── Phase 4 (音頻播放)
    │        │
    │        ├─── Phase 5 (MIDI 裝置)
    │        │        │
    │        │        └─── Phase 6 (練習模式)
    │        │
    │        └─── Phase 7 (樂譜顯示)
    │                 │
    │                 └─── Phase 8 (樂譜編輯) [Extra]
    │
    └─── Phase 9 (打包發佈) ← 可與 Phase 4-8 並行
```

- Phase 4 是後續所有功能的前提（音頻同步機制）
- Phase 5 和 Phase 7 可平行開發（互不依賴）
- Phase 6 依賴 Phase 5（需要 MIDI 輸入才能評分）
- Phase 9 可隨時進行，建議在 Phase 4 完成後就先發佈 v0.2
