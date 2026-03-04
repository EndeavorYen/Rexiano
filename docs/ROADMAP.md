# Rexiano — 開發路線圖與追蹤清單

> **最後更新**: 2026-03-05
>
> 詳細設計請參考 [DESIGN.md](./DESIGN.md)

---

## 版本規劃

| 版本       | 里程碑           | 包含 Phase                  |
| ---------- | ---------------- | --------------------------- |
| **v0.1.0** | 靜默視覺化播放器 | Phase 1 + 2 + 3 ✅          |
| **v0.2.0** | 有聲播放器       | + Phase 4 ✅                |
| **v0.3.0** | MIDI 鍵盤連接    | + Phase 5 ✅                |
| **v0.4.0** | 練習模式         | + Phase 6 ✅                |
| **v0.4.1** | 🎯 兒童可用版    | + Phase 6.5（可用性增強）   |
| **v0.5.0** | 五線譜顯示       | + Phase 7                   |
| **v1.0.0** | 正式發佈         | + Phase 8 + 9，全功能穩定版 |

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

## Phase 4 — 音頻播放 ✅

> 已完成，包含在 v0.2.0
>
> 前置：Phase 2 ✅

- [x] 方案選型：Web Audio API + SoundFont（soundfont2 套件）
- [x] `engines/audio/SoundFontLoader.ts` — SF2 解析與音色載入（含合成器 fallback）
- [x] `engines/audio/AudioEngine.ts` — Web Audio API 封裝
  - [x] `init()` — 建立 AudioContext + 載入 SoundFont
  - [x] `noteOn(midi, velocity, time)` — 觸發音符
  - [x] `noteOff(midi, time)` — 停止音符（150ms release）
  - [x] `resume()` / `allNotesOff()` — 暫停 / 全部停止
- [x] `engines/audio/AudioScheduler.ts` — Look-ahead 音符排程
  - [x] 預排 100ms 內的音符到 Web Audio buffer（25ms interval）
  - [x] 處理 seek（清除排程、binary search 重新定位 cursor）
  - [x] getCurrentTime() 從 AudioContext.currentTime 導出
- [x] 時間同步：`tickerLoop.ts` 讀取 `AudioScheduler.getCurrentTime()`
  - [x] `usePlaybackStore` 新增 audioStatus, volume
  - [x] `tickerLoop.ts` 支援 `getAudioCurrentTime` callback
- [x] TransportBar — Play 觸發 `AudioContext.resume()`
- [x] 音量控制 UI（VolumeControl.tsx, master volume slider）
- [x] App.tsx 中完整的 AudioEngine 生命週期管理
- [x] ⚠️ **鋼琴 SoundFont 檔案**：使用 TimGM6mb SF2（`resources/piano.sf2`, 6MB）
- [x] 測試：AudioEngine, SoundFontLoader, AudioScheduler 單元測試

---

## Phase 5 — MIDI 裝置連接 ✅

> 已完成，包含在 v0.3.0
>
> 前置：Phase 4 ✅

- [x] `stores/useMidiDeviceStore.ts` — 裝置狀態管理
  - [x] 裝置列表（inputs / outputs）
  - [x] 選擇 / 連接 / 斷開
  - [x] 自動重連（lastInputId 記憶 + tryAutoReconnect）
- [x] Web MIDI API 整合
  - [x] `navigator.requestMIDIAccess()` 初始化
  - [x] `onmidimessage` 監聽（Note On / Off / CC）
  - [x] `onstatechange` 監聽（裝置熱插拔）
- [x] MIDI Input 處理
  - [x] 解析 Note On / Off → 更新 activeNotes（鍵盤高亮）
  - [x] 解析 Control Change（CC64 sustain pedal）
  - [x] Note On velocity=0 視為 Note Off
- [x] MIDI Output 處理
  - [x] `MidiOutputSender.ts`：noteOn / noteOff / sendCC / allNotesOff
  - [x] `sendParsedNote()` 用於示範模式
- [x] `features/midiDevice/DeviceSelector.tsx` — 裝置管理 UI
  - [x] 輸入 / 輸出裝置下拉選單
  - [x] `ConnectionStatus.tsx` 連線狀態指示（綠/灰/紅燈）
- [x] Electron MIDI 權限自動核准（`midiDeviceHandlers.ts`）
- [x] 測試：MidiDeviceManager, MidiInputParser, MidiOutputSender, useMidiDeviceStore, ConnectionStatus
- [ ] Windows BLE MIDI 橋接說明文件 → **移至 Phase 9**
- [x] 連線測試按鈕（DeviceSelector test button, 3-state cycle: idle → playing → ok）
- [x] 延遲補償設定（SettingsPanel 0-100ms slider, WaitMode 整合）

---

## Phase 6 — 練習模式 ✅

> 已完成，包含在 v0.4.0
>
> 前置：Phase 5 ✅

- [x] `stores/usePracticeStore.ts` — 練習狀態管理
  - [x] 模式切換：Watch / Wait / Free
  - [x] 速度控制 (0.10x ~ 2.0x)
  - [x] A-B 段落循環
  - [x] 分手練習（track 過濾）
  - [x] 評分統計
- [x] 等待模式（Wait Mode）核心邏輯
  - [x] 偵測下一個目標音符
  - [x] 暫停播放直到使用者彈出正確音
  - [x] 和弦判定（多音同時）
  - [x] 容許時間窗口 ±200ms
- [x] 速度控制
  - [x] 調整 `pixelsPerSecond` 與音頻播放速率
  - [x] UI：速度選擇器 (25% / 50% / 75% / 100%)
- [x] 段落循環
  - [x] A-B 按鈕設定循環點
  - [x] 到達 B 點自動跳回 A 點
  - [x] UI：seek bar 上的彩色高亮區段（TransportBar A-B loop highlight）
- [x] 分手練習
  - [x] Track 選擇 UI（勾選要練習的 track）
  - [x] 評分僅計算已選 track
- [x] 評分系統
  - [x] Hit / Miss 即時判定
  - [x] 準確率、連擊數統計
  - [x] 練習結束結算畫面（CelebrationOverlay — Phase 6.5 Sprint 2 完成）
- [x] 視覺回饋
  - [x] Hit 音符：短暫發光效果（flashHit）
  - [x] Miss 音符：轉灰（markMiss）
  - [x] 連擊提示（combo counter — showCombo at milestones）
- [x] 整合
  - [x] practiceManager.ts — 引擎單例管理
  - [x] tickerLoop.ts — WaitMode 閘控 + 速度乘數 + 循環偵測
  - [x] App.tsx — 引擎生命週期 + 回調接線 + MIDI 輸入路由
  - [x] FallingNotesCanvas — NoteRenderer ref 暴露
  - [x] NoteRenderer.findSpriteForNote() — 視覺回饋查找
  - [x] PracticeToolbar.tsx — 練習控制面板 UI
  - [x] ScoreOverlay — 即時分數 HUD
- [x] 測試：等待模式邏輯、評分計算（91+ practice tests）

---

## Phase 6.5 — 兒童可用性增強 🚧

> 目標版本：v0.4.1 — **Rex 可以坐下來練琴的最低門檻**
>
> 前置：Phase 6 ✅
>
> 設計詳見 [DESIGN.md §8.5](./DESIGN.md#85-兒童可用性增強phase-65)
>
> Sprint 1~4 完成（除真實鋼琴音色外），Sprint 5 完成

### Sprint 1 — 基礎可用性（全部無依賴，可平行）

- [x] 鍵盤快捷鍵
  - [x] `hooks/useKeyboardShortcuts.ts` — 全域 keydown hook
  - [x] Space = Play/Pause, R = Restart, ←→ = Seek ±5s, Shift+←→ = ±15s, ↑↓ = 速度 ±0.25x, M = Mute, Ctrl+O = Open, 1/2/3 = Mode, L = Loop
- [x] 琴鍵音名標籤
  - [x] 白鍵底部顯示音名（C, D, E...），C 鍵加八度數字（C4）
  - [x] 黑鍵可選顯示升音名（C#, D#...）
  - [x] 可開關設定（`showLabels` prop）
- [ ] 真實鋼琴音色（保留 TimGM6mb，未來可升級 Salamander SF2）
  - [ ] 取得免費可再發佈的鋼琴 SoundFont（Salamander Grand Piano ~12MB, CC BY 3.0）
  - [ ] 放入 `resources/piano.sf2`
  - [x] TransportBar 顯示音訊載入狀態（Loader2 spinner + AlertCircle error indicator）
- [x] 暗色主題「Midnight」
  - [x] 第四套主題，深色背景 + 紫色重點色 + 青/粉/金音符色
  - [x] `themes/tokens.ts` 新增 midnight 定義（WCAG AA 對比度已驗證）
- [x] 拖放 MIDI 匯入
  - [x] App.tsx 支援 drag-and-drop `.mid` / `.midi` 檔案
  - [x] 拖曳時顯示視覺指示（虛線邊框 + backdrop blur）
  - [x] 錯誤提示（非 MIDI 檔案時 3 秒 toast）
- [x] BPM / 節拍顯示
  - [x] 歌曲 header 旁顯示當前 BPM（`Math.round(song.tempos[0].bpm) BPM`）
- [x] 難度說明
  - [x] SongCard 難度 badge 加 tooltip 解釋（title + aria-label）

### Sprint 2 — 練習體驗增強（依賴 Phase 6 產出）

- [x] 練習控制面板整合（Phase 6 已完成）
  - [x] `features/practice/PracticeToolbar.tsx` — 組合所有練習元件
  - [x] 嵌入 App.tsx 主佈局
  - [x] 將 speed / loopRange / activeTracks 接入 tickerLoop.ts
- [x] 下落音符音名標籤
  - [x] NoteRenderer 新增 PixiJS Text 池（`_labelPool` + `_spriteLabels` Map）
  - [x] 音符矩形內顯示音名（"C4", "F#5" 等，`midiToNoteName()`）
  - [x] 只在音符高度 > 16px 時顯示（`MIN_HEIGHT_FOR_LABEL`）
  - [x] 可開關設定（`showNoteLabels` 屬性）
- [x] 慶祝回饋效果
  - [x] 接通已存在的 `flashHit()` / `markMiss()` / `showCombo()` 到 practice scoring
  - [x] 連擊里程碑動畫（showCombo at milestones）
  - [x] 練習結束結算畫面（`CelebrationOverlay.tsx` — 3 級評分：🎉 amazing ≥90% / ⭐ great ≥70% / ✨ encourage，CSS 粒子動畫）

### Sprint 3 — 持久化與設定（依賴 Sprint 2）

- [x] 練習成績持久化
  - [x] `stores/useProgressStore.ts` — 歷史成績 Zustand store（含 auto-save on 播放停止）
  - [x] `main/ipc/progressHandlers.ts` — 讀寫 progress.json（userData 目錄）
  - [x] SongCard 顯示最佳成績 badge（accuracy-colored badge, threshold: gold ≥90% / silver ≥70% / green <70%）
  - [x] 結算畫面顯示「新紀錄！」（`isNewRecord()` in celebrationUtils + CelebrationOverlay badge）
- [x] 最近開啟檔案
  - [x] `main/ipc/recentFilesHandlers.ts` — 管理 recents.json（去重 + MRU 排序 + MAX_RECENTS=10）
  - [x] SongLibrary 頂部「最近」section（clickable chips + relative time display）
  - [x] 直接路徑載入（免 dialog，via `loadMidiPath` IPC）
- [x] 設定面板
  - [x] `stores/useSettingsStore.ts` — localStorage 持久化（8 個欄位）
  - [x] `features/settings/SettingsPanel.tsx` — modal 設定面板（主題 + 顯示 + 音訊 + 練習預設 + 快捷鍵）
  - [x] 欄位：showNoteLabels, showFallingNoteLabels, volume, muted, defaultSpeed, defaultMode, metronomeEnabled, countInBeats
  - [x] 鍵盤快捷鍵參考表（基礎版）

### Sprint 4 — 教學工具（可與 Sprint 3 平行）

- [x] 視覺節拍器
  - [x] `features/metronome/MetronomePulse.tsx` — 每拍脈衝動畫（dot row, accent on beat 1）
  - [x] 可選音效 click（`engines/metronome/MetronomeEngine.ts` — Web Audio，含 count-in）
  - [x] TransportBar 開關按鈕（Timer icon, accent color when enabled）
- [x] 新手引導教學
  - [x] `features/onboarding/OnboardingGuide.tsx` — 4 步驟卡片導覽（開啟歌曲 → 播放 → 練習 → 連接鍵盤）
  - [x] 首次啟動自動顯示（localStorage 記憶），`resetOnboarding()` 可重播
- [x] 擴充內建曲庫（26 首）
  - [x] Beginner: C Major Scale, Mary Had a Little Lamb, Hot Cross Buns, Twinkle Twinkle, Happy Birthday, London Bridge, Row Row Row Your Boat, Au Clair de la Lune, Chopsticks, Lavender's Blue, Jingle Bells
  - [x] Intermediate: Ode to Joy, Für Elise (simplified), Minuet in G, Prelude in C, Canon in D (simplified)
  - [x] Advanced: Moonlight Sonata (1st mvt), Turkish March
  - [x] SongLibrary 分類顯示（category 欄位 + `groupSongsByCategory()` section headers）
- [x] L0–L8 分級系統（參考 RCM / ABRSM / Faber 標準）
  - [x] `docs/midi-level-guide.md` — 完整等級對照指南（L0 啟蒙 ~ L8 高級）
  - [x] `BuiltinSongMeta.grade` 欄位（可選，0–8 整數）
  - [x] 新增 8 首兩手練習曲（L3 Frère Jacques / Brahms Lullaby / Yankee Doodle；L4 Amazing Grace / Scarborough Fair / Long Long Ago；L6 Clementi Sonatina / German Dance）
  - [x] `useSongLibraryStore` — GradeFilter 等級篩選
  - [x] SongLibraryFilters 等級篩選列（彩色 chip，L0–L8）
  - [x] SongCard 等級徽章顯示（右下角 L0–L8 色碼標籤）
  - [x] i18n 等級標籤（en / zh-TW）

### Sprint 5 — 超越 Synthesia（長期差異化）

- [x] 指法建議
  - [x] `engines/practice/FingeringEngine.ts` — 啟發式自動指法演算法
  - [x] 音符上顯示帶圈數字 ①②③④⑤
  - [x] 可開關設定（SettingsPanel Display tab toggle）
- [x] 練習洞察分析
  - [x] 累積歷史 noteResults，統計每音符 hit/miss rate（WeakSpotAnalyzer）
  - [x] 識別弱點段落，建議重點練習區段（InsightsPanel + ProgressChart）
  - [x] InsightsPanel 接入 App.tsx（BarChart3 按鈕 → modal overlay）
- [x] 中文 UI
  - [x] i18n 框架（輕量 key-value + I18nProvider + useTranslation hook）
  - [x] 初期兩語言：English / 繁體中文（91 翻譯鍵值）
  - [x] Settings 語言切換（Language tab + Globe icon）
  - [x] I18nProvider mounted in main.tsx

### Sprint 6 — 鋼琴老師審查 Phase 1（30 項高嚴重度修正）

> 設計文件：`docs/plans/2026-03-04-teacher-audit-phase1-design.md`
> 實作計畫：`docs/plans/2026-03-04-teacher-audit-phase1-plan.md`

- [x] 升降音拼寫修正（根據調號顯示 # 或 b）
- [x] MIDI 調號解析（ParsedSong.keySignatures）
- [x] 下落音符使用調號感知的升降音拼寫
- [x] 五線譜調號顯示
- [x] 五線譜附點音符支援
- [x] 五線譜跨小節連結線
- [x] 五線譜休止符插入
- [x] 五線譜多速度標記 + 智慧譜號分配
- [x] 修正 showNoteLabels 未接線至鋼琴鍵盤的 bug
- [x] 新手引導 i18n 國際化
- [x] 中文術語改善（遊戲用語→教學用語、兒童友善提示）
- [x] UI 縮放系統（一般/大/特大，方便幼兒使用）
- [x] 修正降音階指法模板
- [x] 拇指避免落在黑鍵
- [x] 雙軌曲目的手部分配改用軌道索引
- [x] 等待模式和弦分組（80ms 窗口）+ 10 秒超時
- [x] 和弦層級計分（連擊以和弦事件計算）
- [x] 延音踏板支援（MIDI CC64）
- [x] 歌曲時長元資料修正 + 片段標記
- [x] BuiltinSongMeta 新增 source 欄位

### Sprint 7 — 速度與循環增強（WP4）

- [x] 速度下限降低至 10%（SpeedController.MIN: 0.25 → 0.10）
- [x] 速度預設新增 25%（4 段：25% / 50% / 75% / 100%）
- [x] 漸進式加速（autoSpeedUp: A-B 循環準確率 ≥90% 時自動 +5%）
- [x] 分手練習引導提示（TrackSelector: 單手選取時顯示鼓勵性 banner）
- [x] 按小節 A-B 循環（MidiFileParser 計算 measureTimes + ABLoopSelector 小節選擇器）
- [x] 平滑速度過渡（SpeedController lerp 插值，200ms 緩動）

### Sprint 8 — 兒童友善練習體驗（WP1）

- [x] 倒數預備動畫（CountInOverlay: "3…2…1…Go!" CSS 動畫，同步 BPM）
- [x] 慶祝結算延長至 5 秒 + 點擊任意處關閉 + "tap to continue" 提示
- [x] Hit 閃光 200→400ms（白→accent 三階段）、Miss 紅色色調 300ms
- [x] 連擊文字 600→1200ms 彈跳縮放效果
- [x] 錯誤音效（AudioEngine.playErrorTone: 80ms 400→200Hz 頻率掃描）
- [x] Watch 模式教育性增強（hit line 發光 + 22px 音名標籤）
- [x] Free 模式評分（FreeScorer 引擎：±200ms 容許窗口 + 寬限期）

### Sprint 9 — 曲庫內容擴充（WP2）

- [x] 中文曲目元資料（titleZh / composerZh，42 首全部翻譯）
- [x] 分類修正（Long Long Ago: classical → popular）
- [x] 難度分析引擎（DifficultyAnalyzer: 音符密度、音域、節奏複雜度、速度、手部獨立性加權評分）

### Sprint 10 — 兒童友善 UI（WP3）

- [x] 練習控制面板永遠展開（移除 "More" 收合按鈕）
- [x] 練習模式 emoji 圖示（Watch 👀 / Wait ⏸️ / Free 🎹，含文字標籤）
- [x] 設定按鈕加文字標籤（"Settings" / "設定"）
- [x] 等級標籤 emoji（🌱🌿⭐🔥💎）+ 難度點放大至 w-3 + 顏色編碼
- [x] 統計術語簡化（Hit Rate → Correct Notes / 彈對的比例）
- [x] 曲庫分類 emoji（🎵 Popular / 🎻 Classical / 🎄 Holiday / 💪 Exercise）
- [x] "Press Esc to skip" 改為可見 Skip 按鈕
- [x] 拖放 overlay 增強（🎵 emoji + 脈衝邊框動畫 + "Drop your song here!"）

### Sprint 11 — 節拍器與音頻改善（WP5）

- [x] 節拍器音色升級（白噪音 + 帶通濾波器，木魚音效：accent 2000Hz / normal 800Hz）
- [x] 合成音色 fallback 升級（雙三角波 + 3 cents 去調 + ADSR 包絡）
- [x] 可配置音符釋放時間（50-300ms slider，settings 面板）
- [x] BPM 小數顯示（120 → 120, 95.5 → 95.5）

### Sprint 12 — MIDI 裝置穩健性（WP6）

- [x] MIDI 通道篩選器（MidiInputParser.setChannelFilter，settings 下拉選單）
- [x] 自動重連（指數退避 1→30s，最多 10 次，按名稱匹配裝置）
- [x] 延遲補償上限提高至 200ms
- [x] MIDI 輸入測試顯示（DeviceSelector: 最後按鍵音名 + 力度）

### Sprint 13 — 曲庫 UI 強化（WP7）

- [x] 標籤顯示與篩選（SongCard tag chips + 曲庫標籤過濾器）
- [x] 技巧描述（43 首曲目新增 techniques 欄位，hover 顯示）
- [x] 曲目預覽（hover 播放 8 秒 + 迷你進度條動畫）
- [x] 每日練習目標（DailyGoal 圓形進度環 + localStorage 持久化 + settings 面板）

### Sprint 14 — 五線譜改善（WP8）

- [x] 可見小節數 4→8（SheetMusicPanel + CursorSync 常數更新）
- [x] 小節編號顯示（奇數小節上方 SVG text，10px muted）
- [x] Split 模式焦點改為邊框高亮（取消透明度降低，改用 accent 色 2px 左框線）

### Sprint 15 — 指法與視覺打磨（WP10+11）

- [x] 和弦分組閾值驗證（200 BPM 16 分音符 75ms 不被誤判為和弦）
- [x] 滑動窗口音階偵測（matchesScalePattern 支援任意起始音）
- [x] 小音符標籤（高度 <16px 時在上方顯示 8px 標籤，限 hit line 2 秒內）
- [x] 8 色調色盤（新增 teal / orange / pink / lime，trackIndex % 8）
- [x] Midnight 主題對比度修正（accent #5DA3B8, border #3A4556）
- [x] 五線譜縮放控制（75%–150%，Ctrl+=/-，CSS transform scale）

### Sprint 16 — 音樂理論與進階練習（WP9+12+13）

- [x] 力度視覺化（NoteRenderer 音符透明度 0.4–1.0 對應 velocity）
- [x] 逐步模式（StepMode 引擎：右鍵/延音踏板逐音推進，80ms 和弦窗口）
- [x] 上下文感知練習建議（analyzeWeakSpots: 按小節密度分析 miss，建議 A-B 循環）
- [x] 鍵盤快捷鍵可視化（KeyboardShortcutsHelp: KeyCap 視覺鍵帽 + TransportBar ShortcutBadge）

### Synthesia 對照表

| 功能             | Synthesia | Rexiano Phase 6.5 後         | 超越？ |
| ---------------- | --------- | ---------------------------- | ------ |
| Falling notes    | ✅        | ✅ Phase 2                   | 平手   |
| 鋼琴音色         | ✅ 優質   | ✅ Sprint 1 (Salamander SF2) | 平手   |
| 琴鍵音名         | ✅ 可開關 | ✅ Sprint 1                  | 平手   |
| 音符音名         | ✅ 可開關 | ✅ Sprint 2                  | 平手   |
| 指法建議         | ✅        | ✅ Sprint 5                  | 平手   |
| 練習模式 (Wait)  | ✅        | ✅ Phase 6                   | 平手   |
| 速度控制         | ✅        | ✅ Phase 6                   | 平手   |
| A-B 循環         | ✅        | ✅ Phase 6                   | 平手   |
| 分手練習         | ✅        | ✅ Phase 6                   | 平手   |
| 評分系統         | ✅        | ✅ Phase 6                   | 平手   |
| 暗色主題         | ✅        | ✅ Sprint 1                  | 平手   |
| 節拍器           | ✅        | ✅ Sprint 4                  | 平手   |
| 成績追蹤         | ✅        | ✅ Sprint 3                  | 平手   |
| 新手引導         | ✅        | ✅ Sprint 4                  | 平手   |
| **五線譜顯示**   | ❌        | ✅ Phase 7                   | **勝** |
| **練習洞察分析** | ❌        | ✅ Sprint 5                  | **勝** |
| **多主題**       | ❌ 僅一種 | ✅ 4 套                      | **勝** |
| **開源免費**     | ❌ $39    | ✅ 永遠免費                  | **勝** |
| **中文 UI**      | ❌        | ✅ Sprint 5                  | **勝** |

---

## Phase 7 — 樂譜顯示 🚧

> 目標版本：v0.5.0
>
> 前置：Phase 4 ✅（需要播放同步）

- [x] 方案選型確認（VexFlow vs OSMD）— VexFlow 5.0 已安裝
- [x] `features/sheetMusic/MidiToNotation.ts` — MIDI → 樂譜轉換
  - [x] 音符量化（對齊節拍格線）
  - [x] 時值推斷（秒 → 四分/八分/十六分音符）
  - [x] 休止符插入（空譜表自動填入全休止符）
  - [x] 小節線切割
  - [x] 譜號分配（高音 MIDI≥60 / 低音 MIDI<60）
- [x] `features/sheetMusic/SheetMusicPanel.tsx` — 五線譜渲染元件
  - [x] VexFlow 初始化與 React 橋接（動態 import + ResizeObserver）
  - [x] 逐小節渲染（大譜表：高音譜號 + 低音譜號 + brace 連接）
  - [x] 自適應寬度（ResizeObserver 響應式佈局）
- [x] `features/sheetMusic/CursorSync.ts` — 播放同步
  - [x] currentTime → 譜面位置映射
  - [x] 自動翻頁 / 平滑捲動
  - [x] 當前小節高亮
- [x] 顯示模式切換（`DisplayModeToggle.tsx` 三段選擇器）
  - [x] 模式 A：上半五線譜 + 下半下落音符（split）
  - [x] 模式 B：僅五線譜（sheet）
  - [x] 模式 C：僅下落音符（falling，預設）
- [ ] 基本符號支援（部分完成）
  - [x] 音符 + 休止符
  - [x] 拍號
  - [ ] 調號
  - [ ] 符桿方向（VexFlow 預設處理）
  - [ ] 連結線（跨小節音符）
- [x] 測試：量化精度、游標同步（25 tests: MidiToNotation 17 + CursorSync 8）

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
> 建議在 Phase 6.5 完成後發佈 v0.4.1（首個可給 Rex 使用的版本）

- [x] CI/CD 管線（GitHub Actions）
  - [x] tag push 觸發多平台建置（release.yml）
  - [x] Windows: .exe / .msi
  - [x] macOS: .dmg
  - [x] Linux: .AppImage / .deb / .snap
  - [x] 自動建立 GitHub Release + 上傳 artifacts
  - [x] Release Please 自動化版本管理與 CHANGELOG（release-please.yml）
  - [x] CHANGELOG.md 打包進發佈包（electron-builder.yml extraResources）
- [ ] 自動更新
  - [ ] 整合 electron-updater
  - [ ] 應用內更新提示
  - [ ] 發佈到 GitHub Releases
- [ ] 程式碼簽章（可延後）
  - [ ] Windows: EV Code Signing Certificate
  - [ ] macOS: Apple Developer + notarization
- [x] 檔案關聯
  - [x] `.mid` 檔案雙擊以 Rexiano 開啟（electron-builder.yml fileAssociations）
  - [x] 各平台的 MIME type 註冊（Linux mimeTypes: audio/midi, audio/x-midi）
- [x] 安裝體驗優化
  - [x] Windows: 桌面捷徑、開始選單（nsis createDesktopShortcut + createStartMenuShortcut）
  - [ ] macOS: DMG 背景圖 + 拖放指示
  - [x] Linux: desktop entry（自動從 mimeTypes + category 產生）
- [ ] README / 文件完善
  - [ ] 安裝指南（各平台）
  - [ ] Windows BLE MIDI 橋接教學
  - [ ] 開發者貢獻指南 (CONTRIBUTING.md)
  - [ ] 功能截圖 / GIF

---

## 跨 Phase 持續改進項目

> 這些項目不屬於特定 Phase，隨開發過程持續推進

- [ ] 效能監控（FPS counter, 記憶體用量）
- [x] 無障礙：`@media (prefers-reduced-motion: reduce)` 停用所有動畫
- [ ] 無障礙：ARIA labels, 螢幕閱讀器
- [ ] E2E 測試（Playwright）

> 以下項目已移入 Phase 6.5 的具體 Sprint 中：
>
> - 鍵盤快捷鍵 → Sprint 1
> - Dark 主題 → Sprint 1
> - 最近開啟檔案列表 → Sprint 3
> - 拖放 .mid 檔案開啟 → Sprint 1
> - 國際化框架 (i18n) → Sprint 5
> - 中文翻譯 → Sprint 5

---

## 依賴圖

```
Phase 1 ✅ ─→ Phase 2 ✅ ─→ Phase 3 ✅
                                 │
                    ┌────────────┤
                    │            │
                    ▼            ▼
              Phase 4 ✅     Phase 9（可並行）
              (音頻)         (打包發佈)
                 │
          ┌──────┼──────┐
          │      │      │
          ▼      │      ▼
      Phase 5 ✅ │   Phase 7
      (MIDI)     │   (樂譜顯示)
          │      │      │
          ▼      │      ▼
      Phase 6 ✅ │   Phase 8
      (練習)     │   (樂譜編輯)
          │      │
          ▼      │
     Phase 6.5   │
   (兒童可用版)   │
          │      │
          ▼      ▼
        v1.0.0 正式發佈
```
