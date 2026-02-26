# Rexiano — 開發路線圖與追蹤清單

> **最後更新**: 2026-02-26
>
> 詳細設計請參考 [DESIGN.md](./DESIGN.md)

---

## 版本規劃

| 版本 | 里程碑 | 包含 Phase |
|------|--------|-----------|
| **v0.1.0** | 靜默視覺化播放器 | Phase 1 + 2 + 3 ✅ |
| **v0.2.0** | 有聲播放器 | + Phase 4 |
| **v0.3.0** | MIDI 鍵盤連接 | + Phase 5 |
| **v0.4.0** | 練習模式 | + Phase 6 |
| **v0.5.0** | 五線譜顯示 | + Phase 7 |
| **v1.0.0** | 正式發佈 | + Phase 8 + 9，全功能穩定版 |

---

## Phase 1 — 專案骨架與 MIDI 解析 ✅

> 已完成，包含在 v0.1.0

- [x] Electron + React + TypeScript + Tailwind 初始化
- [x] electron-vite 建置管線 (dev / build / typecheck)
- [x] IPC 檔案對話框（系統原生 dialog 選擇 .mid）
- [x] MIDI 解析器（@tonejs/midi → ParsedSong）
- [x] 資料模型定義（ParsedSong / ParsedTrack / ParsedNote）
- [x] 過濾空軌道、時間單位統一為秒
- [x] WSL2 開發環境支援（DPI scaling, sandbox bypass）

---

## Phase 2 — 下落音符引擎 ✅

> 已完成，包含在 v0.1.0

- [x] PixiJS 8 WebGL 初始化 + React 生命週期橋接
- [x] Sprite 物件池（512 初始，動態成長）
- [x] ViewportManager 座標映射（時間 ↔ 像素）
- [x] Binary search 可見音符裁剪
- [x] 88 鍵佈局映射（keyPositions.ts）
- [x] Per-track 音符著色
- [x] 播放控制 — Play / Pause / Reset / Seek slider
- [x] Hit line 偵測（±50ms 寬容窗口）
- [x] PianoKeyboard 即時高亮
- [x] Zustand stores（useSongStore, usePlaybackStore）
- [x] TransportBar 元件（時間顯示、seek bar）
- [x] tickerLoop GC 優化（double-buffered Map）
- [x] 自動停止（播放到結尾）
- [x] 單元測試（NoteRenderer, ViewportManager, keyPositions, FallingNotesCanvas, TransportBar）

---

## Phase 3 — UI 主題系統 ✅

> 已完成，包含在 v0.1.0

- [x] 三套主題定義（Lavender / Ocean / Peach）
- [x] CSS Custom Properties 動態切換
- [x] useThemeStore（Zustand + localStorage 持久化）
- [x] 自訂字型安裝（Nunito, DM Sans, JetBrains Mono via @fontsource）
- [x] Tailwind v4 @theme 整合
- [x] ThemePicker 元件（齒輪圖示 + 色點 popover）
- [x] Welcome 歡迎畫面主題化
- [x] Song header 主題化
- [x] PianoKeyboard micro-3D 樣式（漸層 + 陰影）
- [x] Canvas 背景色隨主題變化
- [x] 自訂 seek slider 樣式
- [x] PixiJS noteColors 隨主題切換

---

## Phase 4 — 音頻播放 🔲

> 目標版本：v0.2.0
>
> 前置：Phase 2 ✅

- [ ] 方案選型確認（Web Audio API + SoundFont vs Tone.js）
- [ ] 選擇並取得鋼琴 SoundFont 檔案（FluidR3_GM 或 Musescore General）
- [ ] `engines/audio/SoundFontLoader.ts` — SF2 解析與音色載入
- [ ] `engines/audio/AudioEngine.ts` — Web Audio API 封裝
  - [ ] `init()` — 建立 AudioContext + 載入 SoundFont
  - [ ] `noteOn(midi, velocity, time)` — 觸發音符
  - [ ] `noteOff(midi, time)` — 停止音符
  - [ ] `stop()` / `resume()` — 暫停 / 繼續
- [ ] `engines/audio/AudioScheduler.ts` — Look-ahead 音符排程
  - [ ] 預排 100ms 內的音符到 Web Audio buffer
  - [ ] 處理 seek（清除排程、重新計算）
  - [ ] 處理 tempo 變化
- [ ] 時間同步：`currentTime` 改用 `AudioContext.currentTime` 驅動
  - [ ] 修改 `usePlaybackStore` 新增 audio 相關狀態
  - [ ] 修改 `tickerLoop.ts` 時間來源
- [ ] TransportBar — Play 觸發 `AudioContext.resume()`
- [ ] 音量控制 UI（master volume slider）
- [ ] SoundFont 資源打包策略（resources/ 目錄）
- [ ] 測試：音畫同步驗證、seek 後音頻正確重排

---

## Phase 5 — MIDI 裝置連接 🔲

> 目標版本：v0.3.0
>
> 前置：Phase 4

- [ ] `stores/useMidiDeviceStore.ts` — 裝置狀態管理
  - [ ] 裝置列表（inputs / outputs）
  - [ ] 選擇 / 連接 / 斷開
  - [ ] 自動重連
- [ ] Web MIDI API 整合
  - [ ] `navigator.requestMIDIAccess()` 初始化
  - [ ] `onmidimessage` 監聽（Note On / Off / CC）
  - [ ] `onstatechange` 監聽（裝置熱插拔）
- [ ] MIDI Input 處理
  - [ ] 解析 Note On / Off → 更新 activeNotes（鍵盤高亮）
  - [ ] 解析 Control Change（踏板 sustain CC64）
  - [ ] 延遲補償設定
- [ ] MIDI Output 處理
  - [ ] 將歌曲 MIDI 事件傳送到外部裝置
  - [ ] 示範模式（鋼琴自動彈奏）
- [ ] `features/settings/MidiDevicePanel.tsx` — 裝置管理 UI
  - [ ] 輸入 / 輸出裝置下拉選單
  - [ ] 連線狀態指示
  - [ ] 連線測試按鈕
- [ ] Windows BLE MIDI 橋接說明文件
- [ ] 測試：模擬 MIDI 輸入、裝置斷線重連

---

## Phase 6 — 練習模式 🔲

> 目標版本：v0.4.0
>
> 前置：Phase 5（需要 MIDI 輸入）

- [ ] `stores/usePracticeStore.ts` — 練習狀態管理
  - [ ] 模式切換：Watch / Wait / Free
  - [ ] 速度控制 (0.25x ~ 2.0x)
  - [ ] A-B 段落循環
  - [ ] 分手練習（track 過濾）
  - [ ] 評分統計
- [ ] 等待模式（Wait Mode）核心邏輯
  - [ ] 偵測下一個目標音符
  - [ ] 暫停播放直到使用者彈出正確音
  - [ ] 和弦判定（多音同時）
  - [ ] 容許時間窗口 ±200ms
- [ ] 速度控制
  - [ ] 調整 `pixelsPerSecond` 與音頻播放速率
  - [ ] 音高校正（變速不變調）
  - [ ] UI：速度選擇器 (25% / 50% / 75% / 100%)
- [ ] 段落循環
  - [ ] seek bar 上拖曳設定 A-B 點
  - [ ] 到達 B 點自動跳回 A 點
  - [ ] UI：seek bar 上的彩色高亮區段
- [ ] 分手練習
  - [ ] Track 選擇 UI（勾選要練習的 track）
  - [ ] 隱藏 track 僅播音頻（伴奏）
  - [ ] 評分僅計算已選 track
- [ ] 評分系統
  - [ ] Hit / Miss 即時判定
  - [ ] 準確率、連擊數統計
  - [ ] 練習結束結算畫面
- [ ] 視覺回饋
  - [ ] Hit 音符：短暫發光效果
  - [ ] Miss 音符：轉灰 + 正確鍵閃爍
  - [ ] 連擊提示（combo counter）
- [ ] 測試：等待模式邏輯、評分計算

---

## Phase 7 — 樂譜顯示 🔲

> 目標版本：v0.5.0
>
> 前置：Phase 4（需要播放同步）

- [ ] 方案選型確認（VexFlow vs OSMD）
- [ ] `engines/notation/MidiToNotation.ts` — MIDI → 樂譜轉換
  - [ ] 音符量化（對齊節拍格線）
  - [ ] 時值推斷（秒 → 四分/八分/十六分音符）
  - [ ] 休止符插入
  - [ ] 小節線切割
  - [ ] 譜號分配（高音 / 低音）
- [ ] `features/sheetMusic/SheetMusicPanel.tsx` — 五線譜渲染元件
  - [ ] VexFlow 初始化與 React 橋接
  - [ ] 逐小節渲染
  - [ ] 自適應寬度（視窗 resize）
- [ ] `features/sheetMusic/CursorSync.ts` — 播放同步
  - [ ] currentTime → 譜面位置映射
  - [ ] 自動翻頁 / 平滑捲動
  - [ ] 當前音符高亮
- [ ] 顯示模式切換
  - [ ] 模式 A：上半五線譜 + 下半下落音符
  - [ ] 模式 B：僅五線譜
  - [ ] 模式 C：僅下落音符（現有預設）
- [ ] 基本符號支援
  - [ ] 音符 + 休止符
  - [ ] 拍號 / 調號
  - [ ] 符桿方向
  - [ ] 連結線（跨小節音符）
- [ ] 測試：量化精度、顯示模式切換

---

## Phase 8 — 樂譜編輯（Extra）🔲

> 目標版本：v1.0.0
>
> 前置：Phase 7（需要樂譜渲染能力）

- [ ] Piano Roll 編輯器
  - [ ] 格線 Canvas（可複用 PixiJS 或獨立 Canvas）
  - [ ] 點擊新增音符
  - [ ] 拖曳移動 / 調整長度
  - [ ] 右鍵 / Delete 刪除
  - [ ] 格線吸附（snap to grid）
- [ ] 編輯工具列
  - [ ] 選取 / 繪製 / 刪除 模式
  - [ ] 量化按鈕
  - [ ] 複製 / 貼上
- [ ] 音符屬性面板
  - [ ] 力度 (velocity) 調整
  - [ ] 音符長度微調
  - [ ] 批次編輯（多選）
- [ ] Undo / Redo
  - [ ] Command Pattern 實作
  - [ ] 鍵盤快捷鍵 Ctrl+Z / Ctrl+Y
- [ ] 匯出
  - [ ] 匯出為 .mid 檔案
  - [ ] （進階）MusicXML 匯入 / 匯出
- [ ] 多軌支援
  - [ ] 新增 / 刪除軌道
  - [ ] 軌道屬性（樂器、通道）
- [ ] 測試：新增 / 移動 / 刪除 / Undo 流程

---

## Phase 9 — 打包與發佈 🔲

> 可與 Phase 4~8 並行進行
>
> 建議在 Phase 4 完成後發佈 v0.2.0

- [ ] CI/CD 管線（GitHub Actions）
  - [ ] tag push 觸發多平台建置
  - [ ] Windows: .exe / .msi
  - [ ] macOS: .dmg
  - [ ] Linux: .AppImage / .deb / .snap
  - [ ] 自動建立 GitHub Release + 上傳 artifacts
- [ ] 自動更新
  - [ ] 整合 electron-updater
  - [ ] 應用內更新提示
  - [ ] 發佈到 GitHub Releases
- [ ] 程式碼簽章（可延後）
  - [ ] Windows: EV Code Signing Certificate
  - [ ] macOS: Apple Developer + notarization
- [ ] 檔案關聯
  - [ ] `.mid` 檔案雙擊以 Rexiano 開啟
  - [ ] 各平台的 MIME type 註冊
- [ ] 安裝體驗優化
  - [ ] Windows: 桌面捷徑、開始選單
  - [ ] macOS: DMG 背景圖 + 拖放指示
  - [ ] Linux: desktop entry
- [ ] README / 文件完善
  - [ ] 安裝指南（各平台）
  - [ ] Windows BLE MIDI 橋接教學
  - [ ] 開發者貢獻指南 (CONTRIBUTING.md)
  - [ ] 功能截圖 / GIF

---

## 跨 Phase 持續改進項目

> 這些項目不屬於特定 Phase，隨開發過程持續推進

- [ ] 鍵盤快捷鍵（Space = Play, R = Reset, ← → = Seek 等）
- [ ] Dark 主題（第四套主題）
- [ ] 最近開啟檔案列表
- [ ] 拖放 .mid 檔案開啟
- [ ] 效能監控（FPS counter, 記憶體用量）
- [ ] 無障礙 (ARIA labels, 螢幕閱讀器)
- [ ] 國際化框架 (i18n) — 預留 key，初期僅英文
- [ ] 中文翻譯
- [ ] E2E 測試（Playwright）

---

## 依賴圖

```
Phase 1 ✅ ─→ Phase 2 ✅ ─→ Phase 3 ✅
                                 │
                    ┌────────────┤
                    │            │
                    ▼            ▼
              Phase 4        Phase 9（可並行）
              (音頻)         (打包發佈)
                 │
          ┌──────┼──────┐
          │      │      │
          ▼      │      ▼
      Phase 5    │   Phase 7
      (MIDI)     │   (樂譜顯示)
          │      │      │
          ▼      │      ▼
      Phase 6    │   Phase 8
      (練習)     │   (樂譜編輯)
                 │
                 ▼
        v1.0.0 正式發佈
```
