# Rexiano — Claude Code 開發指引

## 必讀文件

開發前請先閱讀以下文件，了解專案全貌與當前進度：

- **[docs/ROADMAP.md](docs/ROADMAP.md)** — **進度單一真實來源**（歷史 Phase 勾選 + 產品下一程 + live path）。不要用本檔快照當 backlog。
- **[docs/DESIGN.md](docs/DESIGN.md)** — 系統設計文件（歷史 Phase 1~9 架構、資料模型、技術決策）。歷史寫過的 chrome 不代表還在 live path。
- **[docs/init.md](docs/init.md)** — 原始需求文件（六大核心功能）

## 開發工作流程（必遵守）

每次開發新功能或修復 bug，遵循以下流程：

1. **開發前**：先查 ROADMAP.md 的 live path 與產品下一程，再查 DESIGN.md 對應架構。不要從本檔快照或 Synthesia 對照表開新工作。
2. **實作時**：按照 DESIGN.md 定義的架構與慣例實現，不自行發明新模式。引擎層保持純邏輯（無 React）。
3. **完成後**：若完成 ROADMAP.md 中的任務，更新對應 checkbox（`[ ]` → `[x]`），包含子項目。不要把歷史已勾項目當成「要重建」。
4. **驗證**：執行 `pnpm lint && pnpm typecheck && pnpm test` 確認無回歸

> **重要**：`docs/ROADMAP.md` 才是進度單一真實來源。本檔的表格會過期，不要用它決定下一步。

## Live path（Musk）

Rex 看得到的按鈕 / tab / chip 只留：MIDI 匯入、下落音符、鋼琴鍵盤、聲音、Watch、Wait、速度、zh-TW、內建曲、Windows。

**不要重建**已離開 live surface 的 chrome（磁碟 leftover 模組可留）：Insights、編輯器入口、sheet-only、Free、L0–L8 chips、備份 tab、更新檢查、指法預設開、兒童專注模式、家長報告、MIDI output / 測試鈕。

**不要做**：合併 OSMD / 第二套 notation engine；通用譜匯入器；音樂家級 MIDI→譜轉換器（直到某一首具名曲不可用）；#187 簽章當 live path；把 `site/` 當產品需求。公開發佈檔是 **unsigned**。

## 當前進度（指向 ROADMAP，不是本檔）

歷史 Phase 1–9（含 6.5 兒童可用性、7 五線譜顯示、8 編輯器、9 打包）已在 ROADMAP 勾完。那是工程史，**不是**「6.5+ 還沒開始、要去堆 chrome」。產品下一程是 ROADMAP 裡較不笨的三階段，不是 Synthesia 功能對照表。

## 技術堆疊速查

- **框架**: Electron 39 + React 19 + TypeScript 5.9
- **建置**: electron-vite 5 + Vite 7 + Tailwind CSS 4
- **渲染**: PixiJS 8（下落音符）、CSS（鍵盤 / UI）；樂譜 live renderer 是 **VexFlow**（不要上 OSMD）
- **狀態**: Zustand 5（store 見下方列表；數量以原始檔為準，不要抄本檔舊數字）
- **測試**: Vitest 4（測試放模組旁邊 `*.test.ts`）。測試數量以 `pnpm test` 為準，不要抄過期的「343 tests」。
- **套件管理**: pnpm
- **音頻**: Web Audio API + SoundFont（`resources/piano.sf2`）

## 前端美學守則

DISTILLED_AESTHETICS_PROMPT = """
<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:

- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>
"""

## 已知陷阱

- **WSL2 + Electron**：VS Code 終端設定 `ELECTRON_RUN_AS_NODE=1` 會讓 Electron 以 Node 模式運行，須 `unset` 它。WSL2 不支援 Chromium sandbox，需 `NO_SANDBOX=1`
- **IPC 傳 `number[]` 而非 `Uint8Array`**：Electron structured clone 會遺失 `Uint8Array` 型別，renderer 端再轉回即可

## Zustand Store 一覽

| Store                 | 檔案                            | 用途                                                            |
| --------------------- | ------------------------------- | --------------------------------------------------------------- |
| `useSongStore`        | `stores/useSongStore.ts`        | 當前載入的歌曲（ParsedSong）                                    |
| `usePlaybackStore`    | `stores/usePlaybackStore.ts`    | 播放狀態（currentTime, isPlaying, pixelsPerSecond）             |
| `useThemeStore`       | `stores/useThemeStore.ts`       | 主題選擇 + localStorage 持久化（主題 picker 已離開 live chrome） |
| `useMidiDeviceStore`  | `stores/useMidiDeviceStore.ts`  | MIDI 裝置連接狀態（live chrome 只留 input）                     |
| `useSongLibraryStore` | `stores/useSongLibraryStore.ts` | 曲庫元資料                                                      |
| `usePracticeStore`    | `stores/usePracticeStore.ts`    | 練習狀態（live：Watch / Wait / speed；displayMode 不可為 sheet） |
| `useProgressStore`    | `stores/useProgressStore.ts`    | 練習成績持久化                                                  |
| `useSettingsStore`    | `stores/useSettingsStore.ts`    | 設定持久化（live 面板：語言 + 音量；預設語言 zh-TW）            |

## 開發慣例

- PixiJS 透過 `store.getState()` 直接讀取 Zustand（非 React hook），避免 re-render
- 主題色統一透過 CSS Custom Properties `var(--color-*)` 引用，定義在 `src/renderer/src/themes/tokens.ts`
- 字型使用 @fontsource 離線打包（Nunito / DM Sans / JetBrains Mono），不依賴 CDN
- 測試檔案放在對應模組旁邊（`*.test.ts`），使用 Vitest
- **引擎層（`engines/`）為純邏輯，不依賴 React**；Store 層橋接引擎與 React；Features 層為 UI 元件
- **播放時間由 `engines/transport/TransportClock.ts` 擁有**，不要把時間推進寫回 PixiJS ticker。ticker 只負責畫，讀取 store 的 currentTime。這樣純樂譜模式才能卸載 canvas 而播放不中斷
- **樂譜一律用 tick，不要用秒數反推**。任何需要音樂時間的地方走 `engines/midi/TempoMap.ts`；用 `tempos[0].bpm` 換算只在等速曲正確，變速曲會讓時值與小節線全錯
- 新增建立 `ParsedNote` 的程式碼時，若能取得 tick 就一併填入 `ticks` / `durationTicks`；合成音符可省略，由 `toMusicalNote()` 邊界推導
- 新增 store 或引擎時，遵循現有的 callback pattern（非 EventEmitter）
- **文件中的流程圖 / 架構圖一律使用 Mermaid**（`graph TB` / `flowchart TD` / `stateDiagram-v2`），不使用 ANSI 繪製的 box-drawing 圖形（┌ ─ │ 等）

## Practice Mode 慣例（Phase 6）

Live chrome 只有 **Watch / Wait + 速度**。Free、A-B、分手、Insights、兒童專注進階面板已離開 live surface；leftover 模組可留在 `features/`，不要加回按鈕。

### 架構分層

```
engines/practice/        ← 純邏輯層（無 React 依賴）
  WaitMode.ts           ← 等待模式狀態機（playing → waiting → idle）
  SpeedController.ts    ← 速度控制（0.25x ~ 2.0x，含 clamping）
  LoopController.ts     ← leftover A-B 邏輯（不是 live chrome）
  ScoreCalculator.ts    ← 評分累加器
  practiceManager.ts    ← 模組級單例管理（init / get / dispose）
stores/
  usePracticeStore.ts   ← Zustand store（live：mode Watch/Wait、speed；displayMode 拒絕 sheet）
features/practice/       ← React UI 元件
  PracticeModeSelector  ← Watch / Wait
  SpeedSlider           ← 速度預設 + 滑桿
  PracticeToolbar       ← 組合 Watch/Wait + 速度
```

### 關鍵設計決策

- **WaitMode 使用狀態機 + callback pattern**：`WaitModeCallbacks` 介面（`onWait` / `onResume` / `onHit` / `onMiss`），避免直接依賴 React
- **和弦判定**：WaitMode 收集 ±200ms 時間窗口內的所有音符為一組和弦，需全部按下才繼續
- **引擎類別為純函式型**：SpeedController / LoopController / ScoreCalculator 使用 getter/setter + 驗證，可獨立測試
- **practiceManager.ts 單例模式**：引擎實例以 module-level 變數管理（`initPracticeEngines` / `getPracticeEngines` / `disposePracticeEngines`），tickerLoop 和 App.tsx 透過 import 存取
- **整合已完成**：tickerLoop 中 WaitMode 閘控 + 速度乘數；App.tsx 中引擎生命週期 + 回調接線 + MIDI 輸入路由 + UI 嵌入
- **顯示模式**：預設下落音符 + 鍵盤。Split（譜 + 下落）可當輔助。Sheet-only 不可進入。Live 樂譜引擎是 VexFlow。

## MIDI Device 慣例（Phase 5）

Live chrome 只有 **MIDI input**（含藍牙）。Output 下拉與測試鈕已離開 live surface；`MidiOutputSender` leftover 可留，不要加回按鈕。

### 架構分層

```
engines/midi/          ← 純邏輯層（無 React 依賴）
  MidiDeviceManager.ts ← Singleton，管理 Web MIDI API 存取與裝置列表
  MidiInputParser.ts   ← 解析 MIDI 訊息（Note On/Off/CC），callback-based
  MidiOutputSender.ts  ← leftover 輸出發送（不是 live chrome）
stores/
  useMidiDeviceStore.ts ← Zustand store，橋接 engine → React
features/midiDevice/   ← React UI 元件
  DeviceSelector.tsx   ← 輸入裝置選擇（live）
  ConnectionStatus.tsx ← 連線狀態指示燈
```

### 關鍵設計決策

- **MidiDeviceManager 使用 Singleton**（`getInstance()`），因為 Web MIDI API 的 `MIDIAccess` 物件全域唯一
- **MidiInputParser 使用 callback pattern**（`onNoteOn(cb)` / `onNoteOff(cb)` / `onCC(cb)`），不使用 EventEmitter
- **Parser 與 Store 的橋接**：在 `useMidiDeviceStore` 中以 module-level 變數管理 `_parser` 實例，透過 `syncParserToActiveInput()` 在裝置切換時自動 attach/detach
- **連線狀態指示燈使用固定色（非 theme vars）**：綠/灰/紅具有通用語義意義，需在所有主題下保持一致對比（見 `ConnectionStatus.tsx` JSDoc 說明）
- **Electron MIDI 權限**：在 main process 中透過 `session.setPermissionRequestHandler` 自動核准 `midi` 權限請求（`src/main/ipc/midiDeviceHandlers.ts`）

### 測試注意事項

- Web MIDI API 的 `MIDIInput.onmidimessage` 型別包含 `this: MIDIInput` 約束，測試中需使用 helper 函式 cast 掉此約束（見 `MidiInputParser.test.ts` 中的 `getHandler()`）
- Mock `MIDIInput` 使用 `as unknown as MIDIInput` 型別斷言

## 音頻引擎慣例（Phase 4）

### 架構分層

```
engines/audio/
  AudioEngine.ts       ← Web Audio API 封裝（init / noteOn / noteOff / allNotesOff）
  AudioScheduler.ts    ← Look-ahead 排程器（100ms 預排，25ms interval）
  SoundFontLoader.ts   ← SF2 解析 + 合成器 fallback
```

### 關鍵要點

- **時間基準**：播放中使用 `AudioContext.currentTime`（硬體時鐘），非 `requestAnimationFrame`
- **SoundFont**：`resources/piano.sf2`（TimGM6mb, 6MB），透過 IPC 以 `number[]` 傳送到 renderer
- **合成器 fallback**：若 SF2 載入失敗，退回正弦波合成音色
