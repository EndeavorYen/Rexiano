# Rexiano — Claude Code 開發指引

## 必讀文件

開發前請先閱讀以下文件，了解專案全貌與當前進度：

- **[docs/DESIGN.md](docs/DESIGN.md)** — 系統設計文件（Phase 1~9 完整架構、資料模型、技術決策）
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — 開發路線圖與任務追蹤（checkbox 清單，標示已完成 / 未完成）
- **[docs/init.md](docs/init.md)** — 原始需求文件（六大核心功能）

進度 checkbox 只活在 [docs/ROADMAP.md](docs/ROADMAP.md)。這份文件不記 phase 狀態。DESIGN.md 是架構歷史，不要把它的 Phase 章節、OSMD 對照或簽章描述當成待辦。
樂譜主渲染器是 VexFlow。不要加入 OSMD，不要做 OSMD native cursor，不要做第二套記譜引擎。
Rexiano 只有網頁版（Vercel + PWA），只支援電腦與平板。桌面版已移除，不要加回 Electron，也不要做 issue 187（桌面簽章）。
`site/` 不是產品需求。不要把它寫進 ROADMAP 的下一程。

## 開發工作流程（必遵守）

每次開發新功能或修復 bug，遵循以下流程：

1. **開發前**：先查閱 DESIGN.md 中對應 Phase 的架構設計，確認檔案結構、資料模型、API 介面
2. **實作時**：按照 DESIGN.md 定義的架構與慣例實現，不自行發明新模式
3. **完成後**：更新 ROADMAP.md 對應任務的 checkbox（`[ ]` → `[x]`），包含子項目
4. **驗證**：執行 `pnpm lint && pnpm typecheck && pnpm test` 確認無回歸

> **重要**：ROADMAP.md 的 checkbox 是專案進度的單一真實來源，必須保持準確。完成一項就勾一項，不要等到全部做完才更新。

## 技術堆疊速查

- **框架**: 網頁 App（React 19 + TypeScript 5.9），部署在 Vercel，可安裝成 PWA
- **建置**: Vite 7 + Tailwind CSS 4 + vite-plugin-pwa
- **渲染**: PixiJS 8（下落音符）、CSS（鍵盤 / UI）
- **狀態**: Zustand 5（store 見下方列表）
- **測試**: Vitest 4、Playwright（Chromium，跑 `vite preview`）
- **套件管理**: pnpm
- **音頻**: Web Audio API + SoundFont（`public/piano.sf2`）

## 介面設計：colormon 家族

Rexiano 的介面和 colormon、sudomon 是同一家族（不含寶可夢元素）。新畫面照這套做，不要另創風格：

- **配色**：`src/themes/tokens.ts` 只有 `light` / `dark` 兩套；淺藍灰底 `#EAF1F8`、白卡片、深色字、太陽黃 `#FFC53D` 主要按鈕、綠色是「對」、紅色是「錯」。主題偏好是 跟著系統／淺色／深色（`useThemeStore.preference`）
- **字型**：標題與數字用 Baloo 2，內文用 Noto Sans TC（@fontsource 打包；中文字型不進 precache，用到才快取）
- **元件**（`src/assets/main.css`）：`.family-bar` 頂列、`.icon-btn` 44px 圓角方鈕（`.dot` 是紅點）、`.set-card` 卡片、`.segmented` 分段選擇、`.family-scrim` / `.family-sheet` 對話框、`.btn-primary-themed` 太陽黃按鈕、`.btn-ghost-themed` 外框按鈕
- **頂列**：返回、Logo、標題，右邊是 ⓘ 更新紀錄（`ChangelogButton`）和齒輪設定
- **更新紀錄**：使用者看得到的變更，在 `src/data/changelog.json` 最上面加一版（中英都寫，2–4 條白話），跑 `pnpm changelog` 產生 `CHANGELOG.md`
- **琴鍵**：白鍵長寬約 4:1（`proportionalKeyboardHeight`），黑鍵 0.6 寬、0.63 長；有毛氈條、前緣與陰影。不要再把鍵盤壓扁
- 精緻優先：留白一致（卡片 12–16px 內距、元件間 12px）、44px 以上的點擊區、不用 emoji

## 已知陷阱

- **`window.api` 是網頁 platform 層**（`src/platform/webApi.ts`），不是 IPC。檔案資料仍以 `number[]` 傳遞，沿用桌面版的介面形狀
- **匯入的檔案路徑是 `local:<hash>/<檔名>`**，指向 IndexedDB 裡的檔案，不是磁碟路徑。舊備份裡的絕對路徑會被當成「已遺失」
- **Safari（含所有 iOS / iPadOS 瀏覽器）沒有 Web MIDI 與 Web Bluetooth**。不要假設 `navigator.requestMIDIAccess` 存在
- **Service worker 只在正式 build 註冊**；`VITE_REXIANO_E2E=1` 的 e2e build 不註冊

## 藍牙鋼琴（輸入＋輸出）

只支援藍牙（BLE-MIDI）鋼琴，不支援 USB 鍵盤。同一個藍牙連線雙向使用：琴鍵進來、曲子出去。

```
engines/midi/
  bleMidiPacket.ts       ← BLE-MIDI 封包編碼（20 bytes、13-bit 時間戳）
  BleMidiOutput.ts       ← 自己排程送出（Web Bluetooth 不能預約時間）；pause 讓已響的音自然結束，stop/seek 一律全部停音
  PianoPlaybackOutput.ts ← AudioScheduler 唯一的輸出：藍牙優先，其次 Web MIDI 輸出埠
features/audio/
  pianoOutputPolicy.ts   ← Watch 全送、Wait 只送孩子沒在練的那手、Free 不送；鋼琴出聲時電腦靜音
features/midiDevice/
  pianoBrowserSupport.ts ← 沒有 Web Bluetooth 時：iPad → Bluefy、Mac Safari / 其他 → Chrome 或 Edge
```

- 孩子按的鍵**絕不**送回鋼琴（會變雙重音）
- 連上時送 Program Change 0（平台鋼琴）
- 「其他連線方式」裡的 Web MIDI 只在展開時才初始化，避免一打開抽屜就跳權限

## 網頁 platform 層

```
src/platform/
  types.ts               ← RexianoApi 介面（window.api 的型別）
  webApi.ts              ← 瀏覽器實作：fetch 靜態檔、IndexedDB、檔案選擇、下載、launchQueue
  browserStore.ts        ← IndexedDB key-value（records / files），失敗時退回記憶體
  installWebPlatform.ts  ← 在 main.tsx 啟動時掛上 window.api
```

- Feature 程式碼繼續呼叫 `window.api.*`；新增平台能力時加在 `RexianoApi` 與 `webApi.ts`，並在 `webApi.test.ts` 用 `createMemoryStore()` 測
- 練習紀錄與最近開啟存在 IndexedDB `records`；匯入的檔案存在 `files`（上限 100 個，最久沒開的先刪）

## Zustand Store 一覽

| Store                 | 檔案                            | 用途                                                            |
| --------------------- | ------------------------------- | --------------------------------------------------------------- |
| `useSongStore`        | `stores/useSongStore.ts`        | 當前載入的歌曲（ParsedSong）                                    |
| `usePlaybackStore`    | `stores/usePlaybackStore.ts`    | 播放狀態（currentTime, isPlaying, pixelsPerSecond）             |
| `useThemeStore`       | `stores/useThemeStore.ts`       | 主題選擇 + localStorage 持久化                                  |
| `useMidiDeviceStore`  | `stores/useMidiDeviceStore.ts`  | MIDI 裝置連接狀態                                               |
| `useSongLibraryStore` | `stores/useSongLibraryStore.ts` | 曲庫元資料                                                      |
| `usePracticeStore`    | `stores/usePracticeStore.ts`    | 練習模式狀態（mode / speed / loopRange / activeTracks / score） |
| `useSettingsStore`    | `stores/useSettingsStore.ts`    | 顯示、語言、音量、預設速度與練習預設                            |
| `useProgressStore`    | `stores/useProgressStore.ts`    | 練習 session 紀錄（載入、新增、最佳成績）                       |

## 開發慣例

- PixiJS 透過 `store.getState()` 直接讀取 Zustand（非 React hook），避免 re-render
- 主題色統一透過 CSS Custom Properties `var(--color-*)` 引用，定義在 `src/themes/tokens.ts`
- 字型使用 @fontsource 離線打包（Nunito / DM Sans / JetBrains Mono），不依賴 CDN
- 測試檔案放在對應模組旁邊（`*.test.ts`），使用 Vitest
- **引擎層（`engines/`）為純邏輯，不依賴 React**；Store 層橋接引擎與 React；Features 層為 UI 元件
- **播放時間由 `engines/transport/TransportClock.ts` 擁有**，不要把時間推進寫回 PixiJS ticker。ticker 只負責畫，讀取 store 的 currentTime。這樣純樂譜模式才能卸載 canvas 而播放不中斷
- **樂譜一律用 tick，不要用秒數反推**。任何需要音樂時間的地方走 `engines/midi/TempoMap.ts`；用 `tempos[0].bpm` 換算只在等速曲正確，變速曲會讓時值與小節線全錯
- 新增建立 `ParsedNote` 的程式碼時，若能取得 tick 就一併填入 `ticks` / `durationTicks`；合成音符可省略，由 `toMusicalNote()` 邊界推導
- 新增 store 或引擎時，遵循現有的 callback pattern（非 EventEmitter）
- **文件中的流程圖 / 架構圖一律使用 Mermaid**（`graph TB` / `flowchart TD` / `stateDiagram-v2`），不使用 ANSI 繪製的 box-drawing 圖形（┌ ─ │ 等）

## Practice Mode 慣例（Phase 6）

### 架構分層

```
engines/practice/        ← 純邏輯層（無 React 依賴）
  WaitMode.ts           ← 等待模式狀態機（playing → waiting → idle）
  SpeedController.ts    ← 速度控制（0.25x ~ 2.0x，含 clamping）
  LoopController.ts     ← A-B 段落循環邏輯
  ScoreCalculator.ts    ← 評分累加器（hit/miss/streak/accuracy）
  practiceManager.ts    ← 模組級單例管理（init / get / dispose）
stores/
  usePracticeStore.ts   ← Zustand store（mode / speed / loopRange / activeTracks / score）
features/practice/       ← React UI 元件
  PracticeModeSelector  ← Watch / Wait / Free 模式切換
  SpeedSlider           ← 速度預設按鈕 + 連續滑桿
  TrackSelector         ← 分手練習 track 勾選
  ScoreOverlay          ← 即時分數 HUD（右上角浮動）
  （PracticeModeSelector / SpeedSlider 嵌在 TransportBar 同一條控制列，#289）
```

### 關鍵設計決策

- **WaitMode 使用狀態機 + callback pattern**：`WaitModeCallbacks` 介面（`onWait` / `onResume` / `onHit` / `onMiss`），避免直接依賴 React
- **和弦判定**：WaitMode 收集 ±200ms 時間窗口內的所有音符為一組和弦，需全部按下才繼續
- **引擎類別為純函式型**：SpeedController / LoopController / ScoreCalculator 使用 getter/setter + 驗證，可獨立測試
- **practiceManager.ts 單例模式**：引擎實例以 module-level 變數管理（`initPracticeEngines` / `getPracticeEngines` / `disposePracticeEngines`），tickerLoop 和 App.tsx 透過 import 存取
- **整合已完成**：tickerLoop 中 WaitMode 閘控 + 速度乘數 + 循環偵測；App.tsx 中引擎生命週期 + 回調接線 + MIDI 路由 + UI 嵌入

## MIDI Device 慣例（Phase 5）

### 架構分層

```
engines/midi/          ← 純邏輯層（無 React 依賴）
  MidiDeviceManager.ts ← Singleton，管理 Web MIDI API 存取與裝置列表
  MidiInputParser.ts   ← 解析 MIDI 訊息（Note On/Off/CC），callback-based
  MidiOutputSender.ts  ← 發送 MIDI 訊息到輸出裝置
stores/
  useMidiDeviceStore.ts ← Zustand store，橋接 engine → React
features/midiDevice/   ← React UI 元件
  DeviceSelector.tsx   ← 裝置選擇下拉選單（嵌入 TransportBar）
  ConnectionStatus.tsx ← 連線狀態指示燈
```

### 關鍵設計決策

- **MidiDeviceManager 使用 Singleton**（`getInstance()`），因為 Web MIDI API 的 `MIDIAccess` 物件全域唯一
- **MidiInputParser 使用 callback pattern**（`onNoteOn(cb)` / `onNoteOff(cb)` / `onCC(cb)`），不使用 EventEmitter
- **Parser 與 Store 的橋接**：在 `useMidiDeviceStore` 中以 module-level 變數管理 `_parser` 實例，透過 `syncParserToActiveInput()` 在裝置切換時自動 attach/detach
- **連線狀態指示燈使用固定色（非 theme vars）**：綠/灰/紅具有通用語義意義，需在所有主題下保持一致對比（見 `ConnectionStatus.tsx` JSDoc 說明）
- **MIDI 權限**：由瀏覽器詢問使用者；藍牙 MIDI 用瀏覽器原生配對視窗（`BleMidiManager` → `navigator.bluetooth.requestDevice`）

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
- **SoundFont**：`public/piano.sf2`，由 `window.api.loadSoundFont` 以靜態檔 fetch，並由 service worker 預先快取
- **合成器 fallback**：若 SF2 載入失敗，退回正弦波合成音色
