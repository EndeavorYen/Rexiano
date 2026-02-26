# Agent Team 啟動 Prompt 集 — Rexiano

> 每個 Phase 的 copy-paste ready prompt。
> 直接複製貼入新的 Claude Code session 即可啟動 Agent Team。
>
> 使用前請先完成 **Stage 1（Lead 規劃）**，見 [AGENT_TEAMS.md](./AGENT_TEAMS.md) 第 5 節。

---

## 共用背景段落

以下段落在每個 prompt 中重複使用，已內嵌在各 Phase prompt 裡。
如有修改（例如新增依賴或改了慣例），請同步更新所有 prompt。

```
專案背景：
Rexiano — 開源跨平台鋼琴練習軟體（Synthesia 替代品）。
框架：Electron 33 + React 19 + TypeScript 5.9 + Tailwind 4 + PixiJS 8
狀態管理：Zustand 5
建置：electron-vite 5 + Vite 7
測試：Vitest 4
字型：Nunito (標題) + DM Sans (UI) + JetBrains Mono (等寬)，via @fontsource

已完成：
- Phase 1: MIDI 解析（@tonejs/midi → ParsedSong/ParsedTrack/ParsedNote）
- Phase 2: Falling notes PixiJS 引擎（sprite pool, binary search, 60 FPS）
- Phase 3: 三色主題系統（Lavender/Ocean/Peach, CSS Custom Properties）
- Phase 4: 音訊引擎（AudioEngine + SoundFontLoader + AudioScheduler + 時間同步）
- Phase 5: MIDI 裝置連接（MidiDeviceManager + MidiInputParser + MidiOutputSender + DeviceSelector UI）

開發慣例：
- PixiJS 引擎內用 store.getState() 讀取狀態，不用 React hook
- CSS 色彩用 var(--color-*) 引用 themes/tokens.ts
- IPC 傳 number[] 而非 Uint8Array（避免 structured clone 型別遺失）
- 測試檔案 collocated（*.test.ts 放在源碼旁）
- 遵循 CLAUDE.md 的 frontend_aesthetics 指引（避免 AI slop 風格）
```

---

## Phase 4：Audio Playback（v0.2.0）

### Stage 1 — Lead 前置作業

```
Phase 4 的 scaffold 已完成：
- engines/audio/types.ts — 定義了 IAudioEngine, ISoundFontLoader, IAudioScheduler 介面
- engines/audio/AudioEngine.ts — stub（TODO 未實作）
- engines/audio/SoundFontLoader.ts — stub（TODO 未實作）
- engines/audio/AudioScheduler.ts — stub，已有 constructor 和部分骨架
- stores/usePlaybackStore.ts — 已新增 audioStatus, volume 欄位
- shared/types.ts — 已新增 IpcChannels.LOAD_SOUNDFONT, SoundFontResult

Lead 還需要做：
1. 選定 SoundFont 方案（SF2 解析庫，如 soundfont2 或 pre-split samples）
2. pnpm add 相關依賴
3. 將鋼琴 SoundFont 檔案放入 resources/ 目錄
4. 在 main/index.ts 或 main/ipc/ 註冊 LOAD_SOUNDFONT IPC handler
5. git commit "phase 4: scaffold and soundfont resources"
```

### Stage 2 — Agent Team Prompt

```
建立一個 agent team 來實作 Phase 4 Audio Playback。

專案背景：
Rexiano — 開源跨平台鋼琴練習軟體（Synthesia 替代品）。
框架：Electron 33 + React 19 + TypeScript 5.9 + Tailwind 4 + PixiJS 8
狀態管理：Zustand 5（store.getState() 在引擎內直接讀取）
建置：electron-vite 5 + Vite 7
測試：Vitest 4
字型：Nunito + DM Sans + JetBrains Mono（@fontsource）

已完成：Phase 1-3（MIDI 解析、falling notes PixiJS 引擎、三色主題系統）
Phase 4 目標：讓 falling notes 有聲音——載入鋼琴 SoundFont，透過 Web Audio API 播放。

現有 scaffold（已建立但內部是 TODO stub）：
- src/renderer/src/engines/audio/types.ts — 完整介面定義（IAudioEngine, ISoundFontLoader, IAudioScheduler）
- src/renderer/src/engines/audio/AudioEngine.ts — stub class
- src/renderer/src/engines/audio/SoundFontLoader.ts — stub class
- src/renderer/src/engines/audio/AudioScheduler.ts — 有骨架（constructor, start/stop/seek/dispose, private _tick）
- src/renderer/src/stores/usePlaybackStore.ts — 已有 audioStatus, volume
- src/shared/types.ts — 已有 IpcChannels.LOAD_SOUNDFONT

關鍵設計（來自 DESIGN.md）：
- 時間同步：Phase 2 用 requestAnimationFrame deltaMS 推進時間，Phase 4 需改用 AudioContext.currentTime
  公式：songTime = audioContext.currentTime - startAudioTime + seekOffset
- Look-ahead scheduling：setInterval 每 25ms 跑一次，預排 100ms 內的音符到 Web Audio
- Play 按鈕需呼叫 AudioContext.resume()（瀏覽器自動暫停政策）
- SoundFont 從 Electron resources/ 目錄透過 IPC 載入

團隊（4 人）：

Teammate 1 — Composer（音訊專家）：
  身份：精通 Web Audio API 和 SoundFont 的數位音訊工程師。
  任務：
  1. 實作 SoundFontLoader.ts 的 load() 方法
     - 從 IPC 取得 SF2 二進位資料（或 pre-split samples）
     - 用 AudioContext.decodeAudioData() 解碼每個音符的 sample
     - 存入 _samples Map，確保 O(1) 查詢
  2. 實作 AudioEngine.ts 的全部 TODO 方法
     - init()：建立 AudioContext → master GainNode → 載入 SoundFont
     - noteOn()：從 SoundFontLoader 取 sample → 建 BufferSourceNode + velocity GainNode → 排程播放
     - noteOff()：找到 active source → 排程 release（exponential ramp down）
     - allNotesOff()：停止所有 active BufferSourceNode
     - 管理 active notes Map（midi → source node）避免洩漏
  3. 撰寫單元測試
     - SoundFontLoader.test.ts：mock AudioContext.decodeAudioData
     - AudioEngine.test.ts：mock SoundFontLoader，驗證 lifecycle
  只改：engines/audio/SoundFontLoader.ts, engines/audio/AudioEngine.ts, 和對應 .test.ts
  不改：types.ts（介面已定好），不改任何 UI 或 store

Teammate 2 — Engine Engineer（排程與時間同步）：
  身份：TypeScript 後端工程師，專精非同步排程和時間系統。
  任務：
  1. 實作 AudioScheduler.ts 的全部 TODO
     - start()：記錄 startAudioTime = audioContext.currentTime，seekOffset = songTime
       用 binary search 設定每個 track 的 cursor 到正確位置
     - _tick()：計算 songTime = ctx.currentTime - startAudioTime + seekOffset
       掃描每個 track cursor，將 [songTime, songTime+lookAhead] 範圍內的音符
       排程到 AudioEngine（noteOn 和 noteOff）
     - seek()：allNotesOff → 更新 seekOffset → binary search 重設 cursors → 若在播放中則重啟
     - 注意：要把 songTime 轉成 audioTime 才能傳給 engine.noteOn 的 time 參數
       audioTime = ctx.currentTime + (note.time - songTime)
  2. 修改 engines/fallingNotes/tickerLoop.ts
     - 移除 deltaMS 推進時間的邏輯
     - 改為從 AudioContext.currentTime 計算 currentTime
       songTime = audioContext.currentTime - startAudioTime + seekOffset
     - 若 AudioEngine 未 init（audioContext 為 null），fallback 回原本的 deltaMS 邏輯
     - 確保 isPlaying 為 false 時不推進
  3. 撰寫測試
     - AudioScheduler.test.ts：mock AudioEngine，驗證 cursor advancement, seek, tick scheduling
  只改：engines/audio/AudioScheduler.ts, engines/fallingNotes/tickerLoop.ts, 和對應 .test.ts
  不改：AudioEngine.ts, SoundFontLoader.ts, types.ts, 任何 UI

Teammate 3 — UI/UX Engineer（音訊控制 UI）：
  身份：React + Tailwind 前端工程師。
  任務：
  1. 新增 features/audio/VolumeControl.tsx
     - 音量滑桿（range input）+ 靜音切換按鈕
     - 讀取 usePlaybackStore 的 volume / setVolume
     - 呼叫 AudioEngine.setVolume() 同步
     - 靜音時圖示切換（speaker → speaker-off）
     - 樣式遵循現有 TransportBar 風格，用 var(--color-*) 主題色
  2. 修改 features/fallingNotes/TransportBar.tsx
     - 整合 VolumeControl 元件到 transport bar 右側
     - Play 按鈕 onClick 加入 AudioEngine.resume()（首次觸發需 user gesture）
     - 顯示 audioStatus（loading 時 spinner，error 時提示）
  3. 新增 features/audio/AudioStatusIndicator.tsx
     - 顯示 SoundFont 載入進度 / 狀態
     - uninitialized / loading / ready / error 四種狀態對應不同 UI
  4. 撰寫元件測試
  只改：features/audio/*, features/fallingNotes/TransportBar.tsx, 和對應 .test.ts
  不改：任何 engines/ 程式碼、stores/（使用現有 usePlaybackStore 的欄位）

Teammate 4 — QA Engineer（測試與品質）：
  身份：測試工程師，負責驗證音訊功能的正確性和穩健性。
  任務：
  1. Review 其他三位 teammate 的 code，發現問題直接 message 對方
  2. 撰寫整合層級的測試
     - 測試 AudioEngine + SoundFontLoader 的完整 lifecycle（init → noteOn → noteOff → dispose）
     - 測試 AudioScheduler + AudioEngine 的排程正確性（多 track、seek、pause/resume）
     - 測試 tickerLoop 時間同步（有/無 AudioContext 的 fallback）
  3. 確認所有現有測試仍然通過（pnpm test）
  4. 確認 TypeScript 無錯誤（pnpm typecheck）
  只改：*.test.ts 檔案
  不改：任何非測試程式碼

規則：
- 每位 teammate 嚴格只改自己負責的檔案，讀取其他檔案沒問題
- 有疑問直接 message 對方（例如 Composer 和 Engine 需要對齊 noteOn 的 time 參數含義）
- 介面定義在 types.ts 裡，不要改它，照著實作
- 完成後各自跑 pnpm test 確認通過
```

---

## Phase 5：MIDI Device Connection（v0.3.0）

### Stage 1 — Lead 前置作業

```
Lead 需要做：
1. 在 src/shared/types.ts 新增 MIDI 相關型別和 IPC channels：
   - MidiDeviceInfo { id, name, manufacturer, type: 'input' | 'output' }
   - IpcChannels 新增 MIDI_REQUEST_ACCESS, MIDI_DEVICE_LIST 等
2. 更新 src/preload/index.d.ts 新增 MIDI 相關的 window.api 方法
3. 建立空目錄：
   - src/renderer/src/features/midiDevice/
   - src/renderer/src/engines/midi/（已有 MidiFileParser.ts, types.ts）
4. git commit "phase 5: scaffold midi device types and directories"
```

### Stage 2 — Agent Team Prompt

```
建立一個 agent team 來實作 Phase 5 MIDI Device Connection。

專案背景：
Rexiano — 開源跨平台鋼琴練習軟體（Synthesia 替代品）。
框架：Electron 33 + React 19 + TypeScript 5.9 + Tailwind 4 + PixiJS 8
狀態管理：Zustand 5
測試：Vitest 4

已完成：
- Phase 1-3：MIDI 解析、falling notes 引擎、三色主題
- Phase 4：Web Audio API 音訊引擎（AudioEngine, SoundFontLoader, AudioScheduler, 時間同步）

Phase 5 目標：連接實體 MIDI 鍵盤（USB/Bluetooth），支援輸入（彈奏高亮 + 未來評分）和輸出（示範模式）。

技術要點（來自 DESIGN.md）：
- Web MIDI API：navigator.requestMIDIAccess()，Chromium 原生支援
- MIDI 訊息格式：3 bytes [command, note, velocity]
  - 0x90 = Note On, 0x80 = Note Off, 0xB0 = Control Change
- 裝置熱插拔：監聽 MIDIAccess.onstatechange
- Windows BLE MIDI 需額外橋接軟體（MIDIberry 或 KORG BLE-MIDI Driver）
- MIDI Output 用途：將歌曲 MIDI 事件發送到外部鍵盤喇叭（示範模式）

現有相關程式碼：
- src/renderer/src/engines/midi/MidiFileParser.ts — MIDI 檔案解析（不需改）
- src/renderer/src/engines/midi/types.ts — ParsedSong/ParsedTrack/ParsedNote
- src/renderer/src/features/fallingNotes/PianoKeyboard.tsx — 已有即時高亮功能（onActiveNotesChange callback）
- src/shared/types.ts — Lead 已新增 MIDI device 相關型別和 IPC channels

團隊（4 人）：

Teammate 1 — Composer（MIDI 協定專家）：
  身份：精通 MIDI 協定和 Web MIDI API 的音訊工程師。
  任務：
  1. 新增 engines/midi/MidiDeviceManager.ts
     - 封裝 navigator.requestMIDIAccess({ sysex: false })
     - 管理 inputs/outputs 列表
     - 監聽 onstatechange（裝置熱插拔）
     - 提供 connect(deviceId) / disconnect() 方法
     - 自動重連邏輯（裝置斷線後重新出現時自動 reconnect）
  2. 新增 engines/midi/MidiInputParser.ts
     - 監聽 MIDIInput.onmidimessage
     - 解析 Note On (0x90) / Note Off (0x80) / Control Change (0xB0)
     - Note On velocity=0 視為 Note Off
     - 解析 CC64（sustain pedal）
     - Emit 事件：onNoteOn(midi, velocity), onNoteOff(midi), onCC(cc, value)
  3. 新增 engines/midi/MidiOutputSender.ts
     - 將 ParsedNote 轉為 MIDI bytes 發送到 MIDIOutput
     - 支援 noteOn / noteOff / allNotesOff (CC123)
     - 用於示範模式：根據 AudioScheduler 的排程同步發送
  4. 撰寫單元測試（mock navigator.requestMIDIAccess）
  只改：engines/midi/MidiDeviceManager.ts, MidiInputParser.ts, MidiOutputSender.ts, 及 .test.ts
  不改：MidiFileParser.ts, engines/midi/types.ts（已有的不動）

Teammate 2 — Engine Engineer（IPC 層）：
  身份：Electron Main Process 工程師。
  任務：
  1. 實作 src/main/ipc/midiDeviceHandlers.ts
     - 注意：Web MIDI API 在 Renderer process 中使用，不需要 Main process 中轉
     - 但需要 IPC handler 處理「requestMIDIAccess 的權限確認」（Electron 的 session.setPermissionRequestHandler）
     - 處理 MIDI 相關的 Electron permission 請求
  2. 更新 src/preload/index.ts
     - 新增 MIDI 相關的 contextBridge API（如果需要 Main process 參與）
     - 否則 MIDI 完全在 Renderer 端操作，preload 不需改
  3. 更新 src/preload/index.d.ts — 對齊新的 window.api 型別
  4. 撰寫 IPC 相關測試
  只改：main/ipc/midiDeviceHandlers.ts, preload/index.ts, preload/index.d.ts, main/index.ts (註冊handler), 及 .test.ts
  不改：任何 renderer 端程式碼

Teammate 3 — UI/UX Engineer（MIDI 裝置 UI）：
  身份：React + Zustand 前端工程師。
  任務：
  1. 新增 stores/useMidiDeviceStore.ts
     - inputs: MidiDeviceInfo[], outputs: MidiDeviceInfo[]
     - selectedInputId, selectedOutputId
     - isConnected, connectionError
     - activeNotes: Set<number>（MIDI 輸入的即時按鍵狀態）
     - connect() / disconnect() / selectInput() / selectOutput()
     - onNoteOn / onNoteOff → 更新 activeNotes
  2. 新增 features/midiDevice/DeviceSelector.tsx
     - 輸入裝置下拉選單 + 輸出裝置下拉選單
     - 連線 / 斷開按鈕
     - 連線測試按鈕（送一個 C4 音符確認）
     - 無裝置時顯示提示訊息
  3. 新增 features/midiDevice/ConnectionStatus.tsx
     - 小型狀態指示器（綠燈 = 已連線, 灰燈 = 未連線, 紅燈 = 錯誤）
     - 可嵌入 TransportBar 或 header 區域
  4. 修改 features/fallingNotes/PianoKeyboard.tsx
     - 除了現有的 onActiveNotesChange（來自 falling notes hit line），
       也接收 useMidiDeviceStore 的 activeNotes
     - MIDI 輸入的高亮用不同顏色（如 accent 色）區分 falling notes 的高亮
  5. 撰寫元件測試
  只改：stores/useMidiDeviceStore.ts, features/midiDevice/*, features/fallingNotes/PianoKeyboard.tsx, 及 .test.ts
  不改：engines/, main/, preload/

Teammate 4 — QA Engineer：
  身份：測試工程師。
  任務：
  1. Review 其他 teammate 的程式碼，發現問題直接通知對方
  2. 撰寫 MIDI 模擬測試
     - Mock Web MIDI API（MIDIAccess, MIDIInput, MIDIOutput）
     - 測試裝置列舉、選擇、連線
     - 測試 Note On/Off 解析和 activeNotes 更新
     - 測試裝置斷線 → 重連流程
     - 測試 Control Change (CC64 sustain pedal)
  3. 確認所有現有測試仍然通過
  4. 確認 TypeScript 無錯誤
  只改：*.test.ts
  不改：非測試程式碼

規則：
- 嚴格檔案所有權，不改別人負責的檔案
- Web MIDI API 是 Renderer 端 API，大部分邏輯在 Renderer 操作
- MidiDeviceManager 是引擎層（engines/），useMidiDeviceStore 是 React 層（stores/）
  → Manager 暴露事件，Store subscribe Manager 的事件來更新 UI 狀態
- 遵循現有模式：CSS 色彩 var(--color-*)，字型用已載入的 @fontsource
- 完成後各自跑 pnpm test 確認通過
```

---

## Phase 6：Practice Mode（v0.4.0）

### Stage 1 — Lead 前置作業

```
Lead 需要做：
1. 在 src/shared/types.ts 或 engines/practice/types.ts 定義：
   - PracticeMode = 'watch' | 'wait' | 'free'
   - PracticeScore { totalNotes, hitNotes, missedNotes, accuracy, currentStreak, bestStreak }
   - NoteResult = 'hit' | 'miss' | 'pending'
2. 建立空目錄：
   - src/renderer/src/engines/practice/
   - src/renderer/src/features/practice/
3. git commit "phase 6: scaffold practice mode types and directories"
```

### Stage 2 — Agent Team Prompt

```
建立一個 agent team 來實作 Phase 6 Practice Mode。

專案背景：
Rexiano — 開源跨平台鋼琴練習軟體。
框架：Electron 33 + React 19 + TypeScript 5.9 + Tailwind 4 + PixiJS 8
狀態管理：Zustand 5
測試：Vitest 4

已完成：
- Phase 1-3：MIDI 解析、falling notes 引擎、三色主題
- Phase 4：音訊引擎（AudioEngine + AudioScheduler + 時間同步）
- Phase 5：MIDI 裝置連接（MidiDeviceManager + MidiInputParser + useMidiDeviceStore）

Phase 6 目標：三種練習模式 + 計分 + 變速 + A-B 循環 + 分手練習。
這是 Rexiano 的核心教育功能。

設計規格（來自 DESIGN.md）：

練習模式：
1. Watch Mode（自由觀看）— 現有功能，播放+觀看
2. Wait Mode（等待模式）— 核心功能：
   - 播放到每個音符時暫停，等使用者彈對才繼續
   - 容許時間窗口 ±200ms
   - 和弦：需所有音符都按下才繼續
   - 可設定「僅右手」或「僅左手」（依 track 過濾）
3. Free Mode — 自由練習特定 track，不暫停

速度控制：
- 0.25x ~ 2.0x（調整 pixelsPerSecond 與音頻播放速率）
- 變速不變調（調整排程間隔）

A-B 循環：
- 在 seek bar 上拖曳選取 A-B 點
- 到 B 點自動跳回 A 點重複
- seek bar 上顯示彩色高亮區段

分手練習：
- Track 選擇 UI（通常 Track 1 = 右手, Track 2 = 左手）
- 隱藏 track 仍播放音頻（伴奏）
- 評分僅計算已選 track

評分系統（PracticeScore in stores/usePracticeStore.ts）：
- mode, speed, loopRange, activeTracks, score, noteResults

視覺回饋：
- Hit 音符：短暫發光效果
- Miss 音符：轉半透明灰色 + 鍵盤閃爍正確按鍵
- Combo counter（連擊提示）

現有相關程式碼：
- engines/fallingNotes/tickerLoop.ts — 每幀渲染循環
- engines/fallingNotes/NoteRenderer.ts — PixiJS sprite 渲染（物件池）
- features/fallingNotes/PianoKeyboard.tsx — 88 鍵琴鍵視覺化
- features/fallingNotes/TransportBar.tsx — 播放控制 + seek bar
- stores/usePlaybackStore.ts — currentTime, isPlaying, pixelsPerSecond
- stores/useMidiDeviceStore.ts — activeNotes（MIDI 輸入）
- engines/audio/AudioScheduler.ts — 音符排程（需支援變速）

團隊（4 人）：

Teammate 1 — Engine Engineer（練習邏輯引擎）：
  身份：專精遊戲邏輯和狀態機的 TypeScript 工程師。
  任務：
  1. 新增 engines/practice/WaitMode.ts
     - 核心狀態機：Playing → WaitingForInput → (Correct/Wrong) → Playing
     - 追蹤「下一個目標音符」（可能是多音和弦）
     - 接收 MIDI input（useMidiDeviceStore.activeNotes）比對目標
     - 容許窗口 ±200ms（音符到達 hit line 前後）
     - 和弦判定：Set<midi> 完全匹配才通過
     - 彈錯時不推進，標記為 miss
     - 支援 activeTracks 過濾（只判定選中的 track）
  2. 新增 engines/practice/SpeedController.ts
     - 管理 playback speed multiplier (0.25 ~ 2.0)
     - 修改 pixelsPerSecond 的有效值 = base * speedMultiplier
     - 通知 AudioScheduler 調整排程間隔
     - 不影響音高（排程間隔拉長/縮短，但 sample 不做 pitch shift）
  3. 新增 engines/practice/LoopController.ts
     - 管理 A-B 循環範圍 [startTime, endTime]
     - 在 tickerLoop 中：若 currentTime >= endTime → seek 回 startTime
     - 通知 AudioScheduler seek
  4. 新增 engines/practice/ScoreCalculator.ts
     - 接收事件：noteHit(midi, time), noteMiss(midi, time)
     - 累計 totalNotes, hitNotes, missedNotes
     - 計算 accuracy = hitNotes / totalNotes * 100
     - 追蹤 currentStreak, bestStreak
     - 提供 reset() 和 getResults() 方法
  5. 撰寫所有引擎測試
  只改：engines/practice/* 及 .test.ts
  不改：任何 UI 元件、stores、其他 engines

Teammate 2 — UI/UX Engineer（練習模式 UI）：
  身份：React + Zustand 前端工程師。
  任務：
  1. 新增 stores/usePracticeStore.ts
     - mode: 'watch' | 'wait' | 'free'（預設 watch）
     - speed: number（預設 1.0，範圍 0.25-2.0）
     - loopRange: [number, number] | null
     - activeTracks: Set<number>（預設全選）
     - score: PracticeScore
     - noteResults: Map<string, 'hit' | 'miss' | 'pending'>
     - setMode(), setSpeed(), setLoopRange(), setActiveTracks()
     - recordHit(), recordMiss(), resetScore()
  2. 新增 features/practice/PracticeModeSelector.tsx
     - 三個模式按鈕：Watch / Wait / Free
     - 當前模式高亮顯示
     - 切換時 reset score
  3. 新增 features/practice/SpeedSlider.tsx
     - 滑桿或預設按鈕組（0.25x / 0.5x / 0.75x / 1.0x）
     - 顯示當前倍速
     - 可自訂（滑桿拖曳到任意值）
  4. 新增 features/practice/ABLoopSelector.tsx
     - 嵌入 TransportBar 的 seek bar 區域
     - 拖曳設定 A 和 B 點
     - seek bar 上顯示彩色高亮區段
     - 清除循環按鈕
  5. 新增 features/practice/TrackSelector.tsx
     - 勾選框列表，顯示各 track 名稱
     - 勾選 = 納入練習 + 評分
     - 未勾選 = 僅播放伴奏，不評分
  6. 新增 features/practice/ScoreOverlay.tsx
     - 練習中：角落顯示即時分數（accuracy%, combo）
     - 練習結束：全屏結算面板（總分、命中率、最佳連擊、建議）
  7. 撰寫元件測試
  只改：stores/usePracticeStore.ts, features/practice/*, 及 .test.ts
  不改：engines/, 其他 features/, themes/

Teammate 3 — Frontend Designer（視覺回饋 + 動效）：
  身份：前端動效設計師，遵循 CLAUDE.md 的 frontend_aesthetics 指引。
  不要用 AI slop 風格——設計要有個性、有驚喜感。
  任務：
  1. 修改 engines/fallingNotes/NoteRenderer.ts — 新增視覺回饋
     - 不改核心渲染邏輯（sprite pool, binary search 不動）
     - 新增方法：flashHit(noteKey) — 短暫發光效果（tint + alpha 動畫）
     - 新增方法：markMiss(noteKey) — 轉灰色半透明
     - 新增方法：showCombo(count) — combo 數字浮動動畫
     - 效果用 PixiJS 原生 API（tint, alpha, scale 動畫），不引入額外依賴
  2. 修改 features/fallingNotes/PianoKeyboard.tsx — 練習回饋
     - 不改現有的 active notes 高亮邏輯
     - 新增：miss 時正確按鍵閃爍效果（CSS @keyframes 或 transition）
     - 新增：hit 時按鍵短暫變色效果
     - 效果要和主題系統相容（用 var(--color-*) 色彩）
  3. 更新 themes/tokens.ts — 新增 practice mode 色彩
     - 每套主題新增：hitGlow, missGray, comboText, streakGold
     - 選色要和各主題（Lavender/Ocean/Peach）協調
  4. 更新 assets/main.css — 動效 CSS
     - @keyframes for miss-blink, hit-flash
     - 分數面板的入場動畫
  5. 撰寫動效相關測試（驗證 tint/alpha 值有變化）
  只改：engines/fallingNotes/NoteRenderer.ts（只加動效方法，不改渲染核心），
        features/fallingNotes/PianoKeyboard.tsx（只加動效，不改高亮邏輯），
        themes/tokens.ts, assets/main.css, 及 .test.ts
  重要：修改 NoteRenderer 和 PianoKeyboard 前，先讀完現有程式碼，
        確認你只新增方法/樣式，不改動任何現有邏輯

Teammate 4 — QA Engineer：
  身份：測試工程師。
  任務：
  1. Review 所有 teammate 的程式碼
  2. 撰寫練習模式核心測試：
     - WaitMode 狀態機：正確音 → 繼續、錯誤音 → 不繼續、和弦判定
     - SpeedController：0.5x 時 pixelsPerSecond 減半
     - LoopController：到達 B 點 → 跳回 A 點
     - ScoreCalculator：accuracy 計算、streak 追蹤
     - 分手練習：未選 track 不納入評分
  3. 整合測試：模式切換 → 重設分數、速度變更 → 排程正確
  4. 確認所有現有測試通過 + TypeScript 無錯誤
  只改：*.test.ts
  不改：非測試程式碼

規則：
- 檔案所有權嚴格遵守
- Designer 改 NoteRenderer.ts 時「只加新方法」，不動 renderNotes / updateSprites 等核心函式
- Designer 改 PianoKeyboard.tsx 時「只加 CSS class 和 useEffect」，不動 key mapping 邏輯
- Engine 和 UI/UX 對齊介面：Engine 暴露事件（onWait, onResume, onHit, onMiss），
  Store subscribe 這些事件
- 完成後各自跑 pnpm test
```

---

## Phase 6.5：兒童可用性增強（v0.4.1）

### Stage 1 — Lead 前置作業

```
Lead 需要做：
1. 下載並放入鋼琴 SoundFont 到 resources/piano.sf2
   - 推薦：Musescore_General_Lite.sf2（~30MB）或 FluidR3_GM_GS.sf2
   - 確認 AudioEngine / SoundFontLoader 能正確載入（可能需微調路徑）
   - 在 main process 確認 LOAD_SOUNDFONT IPC handler 指向正確檔案
2. 在 src/shared/types.ts 新增：
   - SessionRecord { id, songId, songTitle, timestamp, mode, speed, score, durationSeconds, tracksPlayed }
   - IpcChannels 新增 SAVE_SESSION, LOAD_SESSIONS
3. 建立空目錄：
   - src/renderer/src/hooks/
   - src/renderer/src/features/onboarding/
   - src/renderer/src/features/insights/
   - src/renderer/src/engines/metronome/
4. git commit "phase 6.5: scaffold usability enhancements"
```

### Stage 2 — Agent Team Prompt

```
建立一個 agent team 來實作 Phase 6.5 兒童可用性增強。

專案背景：
Rexiano — 開源跨平台鋼琴練習軟體（Synthesia 替代品）。
框架：Electron 33 + React 19 + TypeScript 5.9 + Tailwind 4 + PixiJS 8
狀態管理：Zustand 5（store.getState() 在引擎內直接讀取）
建置：electron-vite 5 + Vite 7
測試：Vitest 4
字型：Nunito + DM Sans + JetBrains Mono（@fontsource）

已完成：
- Phase 1-3：MIDI 解析、falling notes 引擎、三色主題
- Phase 4：音訊引擎（AudioEngine + SoundFontLoader + AudioScheduler + 時間同步）
- Phase 5：MIDI 裝置連接（MidiDeviceManager + MidiInputParser + MidiOutputSender）
- Phase 6：練習模式（WaitMode + SpeedController + LoopController + ScoreCalculator + UI）
- resources/piano.sf2：已放入真實鋼琴 SoundFont（Lead 在 Stage 1 完成）

Phase 6.5 目標：讓 6 歲兒童能獨立坐下練琴。目前缺少：
- 琴鍵沒有音名標籤（初學者不知道哪個鍵是什麼音）
- 下落音符沒有音名（只靠顏色區分左右手）
- 沒有鍵盤快捷鍵（練琴時手不離鍵盤）
- 沒有暗色主題（夜間練琴刺眼）
- 沒有拖放匯入（要透過選單開檔案）
- 沒有設定面板（設定散落各處）
- 沒有成績保存（無法追蹤進步）
- 沒有慶祝效果（練習結束缺少正面回饋）
- 沒有新手引導（首次啟動不知從何開始）

設計規格：見 DESIGN.md §9（Phase 6.5 完整設計）

開發慣例：
- PixiJS 引擎內用 store.getState() 讀取狀態，不用 React hook
- CSS 色彩用 var(--color-*) 引用 themes/tokens.ts
- IPC 傳 number[] 而非 Uint8Array
- 測試檔案 collocated（*.test.ts 放在源碼旁）
- 遵循 CLAUDE.md 的 frontend_aesthetics 指引（避免 AI slop 風格）

團隊（4 人）：

Teammate 1 — UX Engineer（互動增強）：
  身份：專精 React hooks 和鍵盤互動的前端工程師。
  任務：
  1. 新增 hooks/useKeyboardShortcuts.ts
     - useEffect → window.addEventListener('keydown', handler)
     - 快捷鍵對照（見 DESIGN.md §9.3 完整表格）：
       Space=Play/Pause, R=Reset, ←→=Seek 5s, Shift+←→=Seek 15s,
       ↑↓=Speed ±25%, L=Loop, 1/2/3=Mode, M=Mute, Ctrl+O=Open, ?=Help
     - e.target 檢查：input/textarea 內不攔截
     - cleanup：useEffect return 移除 listener
  2. 修改 features/fallingNotes/PianoKeyboard.tsx — 琴鍵音名標籤
     - 在每個琴鍵 DOM 元素中加入 <span> 顯示音名（C4, D4, F#4 等）
     - 白鍵：底部居中，JetBrains Mono 10px，opacity 0.6
     - 黑鍵：底部居中，白色文字
     - 受 useSettingsStore.showNoteLabels 控制
  3. 修改 engines/fallingNotes/NoteRenderer.ts — 下落音符音名
     - 新增 BitmapFont atlas（JetBrains Mono 12px bold white）
     - 平行管理 BitmapText pool（初始 256 個）
     - 在音符矩形內垂直居中顯示音名
     - 音符高度 < 16px 時不顯示（避免文字溢出）
     - 受 useSettingsStore.showFallingNoteLabels 控制
  4. 新增拖放匯入
     - 在 App.tsx 加入 onDragOver/onDrop 事件監聽
     - 拖入時顯示半透明 overlay：「拖放 .mid 檔案到此處」
     - 驗證副檔名（.mid, .midi），非法格式顯示錯誤
     - 成功後走 useSongStore.loadSong() 現有流程
  5. 撰寫測試
  只改：hooks/useKeyboardShortcuts.ts, features/fallingNotes/PianoKeyboard.tsx,
        engines/fallingNotes/NoteRenderer.ts（只加音名相關，不改渲染核心），
        App.tsx（只加拖放事件），及對應 .test.ts
  不改：stores/, themes/, engines/audio/, engines/practice/

Teammate 2 — UI Designer（主題與面板）：
  身份：React + Tailwind 前端設計師，遵循 CLAUDE.md frontend_aesthetics 指引。
  不要用 AI slop 風格——設計要有個性、有驚喜感。
  任務：
  1. 更新 themes/tokens.ts — 新增 Midnight 暗色主題
     - 色票見 DESIGN.md §9.4（bg: #0f0f14, accent: #7c6ef0 等完整定義）
     - 與 Lavender/Ocean/Peach 並列於 themes 物件
  2. 修改 features/settings/ThemePicker.tsx
     - 新增第四個色點（深灰 + 月亮圖示）
     - 或者：升級為完整的 SettingsPanel.tsx（取代 ThemePicker）
  3. 新增 features/settings/SettingsPanel.tsx
     - Modal/Drawer 形式，從 TransportBar 齒輪圖示觸發
     - 分區：顯示（音名開關）、音頻（音量/靜音）、練習（速度/模式/節拍器）、主題
     - 見 DESIGN.md §9.5 完整 UI mockup
  4. 新增 stores/useSettingsStore.ts
     - showNoteLabels, showFallingNoteLabels, volume, muted,
       defaultSpeed, defaultMode, metronomeEnabled, countInBeats
     - localStorage 自動同步（與 themeStore 同模式）
  5. 新增 features/onboarding/OnboardingGuide.tsx
     - 首次啟動顯示 3-5 步引導 overlay
     - 步驟：匯入 MIDI → Space 播放 → 練習模式 → 連接鍵盤
     - localStorage 記錄 onboardingCompleted
  6. 新增 features/practice/CelebrationOverlay.tsx
     - 練習結束時根據 accuracy 顯示慶祝動畫：
       ≥90%：confetti + 太棒了、≥70%：星星 + 做得好、<70%：鼓勵文字
     - 結算畫面：Modal 顯示 PracticeScore 詳細 + 最佳對比 + 重新練習按鈕
  7. 撰寫元件測試
  只改：themes/tokens.ts, stores/useSettingsStore.ts,
        features/settings/*, features/onboarding/*, features/practice/CelebrationOverlay.tsx,
        及對應 .test.ts
  不改：engines/, hooks/, features/fallingNotes/（那是 UX Engineer 的）

Teammate 3 — Engine Engineer（持久化與整合）：
  身份：Electron IPC + Zustand 後端工程師。
  任務：
  1. 新增 stores/useProgressStore.ts
     - sessions: SessionRecord[]
     - addSession(), getSessionsBySong(), getRecentSessions(), getBestScore()
     - 持久化：透過 IPC 存取 app.getPath('userData')/progress.json
  2. 新增 src/main/ipc/progressHandlers.ts
     - SAVE_SESSION handler：接收 SessionRecord → 寫入 JSON 檔
     - LOAD_SESSIONS handler：讀取 JSON 檔 → 回傳 SessionRecord[]
     - 更新 preload/index.ts 和 preload/index.d.ts
  3. 新增最近檔案功能
     - 記錄最近 10 個 MIDI 檔案路徑 + 檔名
     - 儲存於 localStorage 或 electron-store
     - UI 端由 Teammate 2 整合，Engine 只負責存取邏輯
  4. 整合練習面板到播放流程（wire tickerLoop）
     - 確認 usePracticeStore → engines/practice/ 的事件橋接正常
     - 確認 WaitMode 暫停/恢復透過 tickerLoop 正確運作
     - 確認 ScoreCalculator 結果正確寫入 usePracticeStore
     - 練習結束時自動呼叫 addSession() 保存成績
  5. 新增 engines/metronome/MetronomeEngine.ts
     - Web Audio API 產生 click 音（oscillator 短脈衝）
     - 每拍觸發一次（強拍不同音高）
     - 透過 useSettingsStore.metronomeEnabled 控制
     - 預備拍（count-in）：播放前先打 N 拍
  6. 撰寫所有引擎和 IPC 測試
  只改：stores/useProgressStore.ts, main/ipc/progressHandlers.ts,
        preload/index.ts, preload/index.d.ts,
        engines/metronome/*, engines/practice/*（只改整合層，不改核心邏輯），
        及對應 .test.ts
  不改：features/（UI 由 Teammate 2 負責），themes/, hooks/

Teammate 4 — QA Engineer（測試與品質）：
  身份：測試工程師，負責整合測試和回歸驗證。
  任務：
  1. Review 其他三位 teammate 的程式碼，發現問題直接 message 對方
  2. 鍵盤快捷鍵測試：
     - 所有快捷鍵功能正確
     - input/textarea 內不觸發
     - 多鍵組合（Shift+→, Ctrl+O）正確
  3. 琴鍵音名測試：
     - 88 個鍵的音名正確（C1 ~ C8）
     - 黑鍵顯示 sharp 而非 flat
     - showNoteLabels=false 時不顯示
  4. 暗色主題測試：
     - Midnight 主題切換不 crash
     - 所有 var(--color-*) 在 Midnight 下有定義
     - 對比度足夠（文字可讀）
  5. 成績持久化測試：
     - 保存 → 讀取 → 資料一致
     - JSON 檔格式正確
     - 最佳成績查詢正確
  6. 設定面板測試：
     - 所有設定項持久化（重啟後恢復）
     - toggle 操作正確反映到 UI
  7. 確認所有現有測試仍通過（pnpm test）
  8. 確認 TypeScript 無錯誤（pnpm typecheck）
  只改：*.test.ts
  不改：非測試程式碼

規則：
- 每位 teammate 嚴格只改自己負責的檔案，讀取其他檔案沒問題
- 有疑問直接 message 對方
- useSettingsStore 由 Teammate 2 建立，其他人只讀取不修改 store 定義
- useProgressStore 由 Teammate 3 建立，其他人只讀取不修改 store 定義
- 完成後各自跑 pnpm test 確認通過
- 遵循現有模式：CSS 色彩 var(--color-*)，PixiJS 用 store.getState()
```

---

## Phase 7：Sheet Music Display（v0.5.0）

### Stage 1 — Lead 前置作業

```
Lead 需要做：
1. pnpm add vexflow（樂譜渲染庫）
2. 在 engines/notation/types.ts 定義：
   - NotationNote { pitch, duration, rest, tie, ... }
   - Measure { notes, timeSignature, keySignature, clef }
   - DisplayMode = 'split' | 'sheet-only' | 'notes-only'
3. 建立空目錄：
   - src/renderer/src/engines/notation/
   - src/renderer/src/features/sheetMusic/
4. git commit "phase 7: scaffold notation types and add vexflow"
```

### Stage 2 — Agent Team Prompt

```
建立一個 agent team 來實作 Phase 7 Sheet Music Display。

專案背景：
Rexiano — 開源跨平台鋼琴練習軟體。
框架：Electron 33 + React 19 + TypeScript 5.9 + Tailwind 4 + PixiJS 8
狀態管理：Zustand 5
測試：Vitest 4

已完成：Phase 1-6（MIDI 解析、falling notes、主題、音訊、MIDI 裝置、練習模式）

Phase 7 目標：在 falling notes 之外提供傳統五線譜顯示，用 VexFlow 渲染。

技術挑戰（來自 DESIGN.md）：
MIDI 是「演奏資料」不是「樂譜資料」，轉換需處理：
1. 量化 (Quantization)：浮點秒數 → 對齊到 16 分音符格線
2. 時值推斷：秒 → 根據 tempo 反推四分/八分/十六分音符
3. 休止符插入：MIDI 無明確休止符，從音符間隙推斷
4. 譜號分配：Middle C (MIDI 60) 為界，上方高音 / 下方低音
5. 連結線：跨小節音符需 tie 表示
初期只支援基本單音旋律，和弦和複雜節奏逐步完善。

三種顯示模式：
- 模式 A (split)：上半五線譜 + 下半 falling notes + 鍵盤
- 模式 B (sheet-only)：全屏五線譜 + 鍵盤
- 模式 C (notes-only)：僅 falling notes + 鍵盤（現有預設）

現有相關程式碼：
- engines/midi/types.ts — ParsedSong, ParsedTrack, ParsedNote
- stores/usePlaybackStore.ts — currentTime（播放同步源）
- App.tsx — 主要佈局路由
- VexFlow 已安裝（Lead 在 Stage 1 完成）

團隊（4 人）：

Teammate 1 — Engine Engineer（MIDI → 樂譜量化引擎）：
  身份：精通樂理和演算法的 TypeScript 工程師。
  任務：
  1. 實作 engines/notation/MidiToNotation.ts — MIDI → 樂譜轉換
     - quantize(notes, tempo, timeSignature)：
       將 ParsedNote[] 的浮點時間對齊到 16 分音符格線
     - inferDuration(note, tempo)：
       秒 → 節拍數 → 最接近的標準時值（whole, half, quarter, eighth, sixteenth）
     - insertRests(notes, measureDuration)：
       在音符間隙插入休止符
     - splitByMeasure(notes, timeSignature, tempo)：
       依小節線切割成 Measure[]
     - assignClef(midi)：
       MIDI 60 為界，≥60 高音譜號，<60 低音譜號
     - handleTies(notes, measureBoundaries)：
       跨小節音符產生 tie
  2. 實作 engines/notation/MeasureBuilder.ts
     - 接收 quantized notes → 輸出 Measure[] 結構
     - 處理拍號變化（從 ParsedSong.timeSignatures）
     - 處理 tempo 變化（從 ParsedSong.tempos）
  3. 撰寫完整單元測試
     - 量化精度測試（微小時間偏差 → 對齊到正確格線）
     - 不同拍號（4/4, 3/4, 6/8）
     - 休止符插入正確性
     - 跨小節 tie
     - 和弦（多音同時）量化
  只改：engines/notation/* 及 .test.ts
  不改：任何 UI, stores, 其他 engines

Teammate 2 — UI/UX Engineer（五線譜 UI + 模式切換）：
  身份：React 前端工程師。
  任務：
  1. 實作 features/sheetMusic/SheetMusicView.tsx
     - 整合 VexFlow：建立 Renderer → SVG context → Stave → StaveNote
     - 接收 Measure[] → 逐小節渲染
     - 自適應寬度（監聽 window resize）
     - 高音譜號 + 低音譜號（Grand Staff for piano）
  2. 實作 features/sheetMusic/CursorSync.tsx
     - 讀取 usePlaybackStore.currentTime
     - 計算當前播放位置 → 對應的 measure + beat
     - 高亮當前音符（VexFlow StaveNote 的 style）
     - 自動捲動：當前 measure 超出視窗 → 平滑捲到可見區域
  3. 實作 features/sheetMusic/DisplayModeSelector.tsx
     - 三個模式按鈕（Split / Sheet Only / Notes Only）
     - 儲存在 localStorage 持久化
  4. 修改 App.tsx（或由 Lead 協調）
     - 根據 displayMode 渲染不同佈局：
       - split：flex-col → [SheetMusicView, FallingNotesCanvas, PianoKeyboard]
       - sheet-only：[SheetMusicView, PianoKeyboard]
       - notes-only：[FallingNotesCanvas, PianoKeyboard]（現有）
  5. 撰寫元件測試
  只改：features/sheetMusic/*, App.tsx（若 Lead 同意）, 及 .test.ts
  不改：engines/, stores/, 其他 features/

Teammate 3 — Frontend Designer（樂譜視覺風格）：
  身份：前端視覺設計師，遵循 CLAUDE.md frontend_aesthetics 指引。
  任務：
  1. 設計 SheetMusicView 的視覺風格
     - VexFlow 的 CSS 樣式覆寫（SVG stroke/fill 顏色 → 配合主題）
     - 五線譜背景：微妙的紙張質感或淡色漸層（非純白）
     - 音符顏色隨主題（用 var(--color-*) 映射）
  2. 光標動畫
     - 當前播放位置的光標：垂直線 + 發光效果
     - 平滑移動（CSS transition 或 requestAnimationFrame）
  3. 更新 themes/tokens.ts
     - 每套主題新增：sheetBg, staffLine, noteHead, cursor, measureLine
  4. 更新 assets/main.css
     - VexFlow SVG 元素的主題化
     - 模式切換的過場動畫
     - split mode 的上下分區邊界效果
  5. 顯示模式切換按鈕的設計
     - 圖示化（而非純文字）
     - 動效過場
  只改：themes/tokens.ts, assets/main.css, 及相關 CSS
  注意：不直接改 .tsx 元件的邏輯，只改樣式。
        若需要加 CSS class，告知 UI/UX Engineer 加到元件上

Teammate 4 — QA Engineer：
  身份：測試工程師。
  任務：
  1. Review 所有程式碼
  2. 量化演算法的嚴格測試：
     - 各種拍號（2/4, 3/4, 4/4, 6/8, 5/4）
     - Tempo 變化（中途 accelerando）
     - 極短音符、極長音符
     - 三連音（量化到最近的 triplet grid）
     - 空白小節（全休止符）
  3. 顯示模式切換：
     - Split ↔ Sheet-Only ↔ Notes-Only 切換不會 crash
     - 切換後 currentTime 同步正確
  4. 確認所有現有測試通過 + TypeScript 無錯誤
  只改：*.test.ts

規則：
- 量化演算法是本 Phase 最難的部分，Engine Engineer 完成後 QA 要重點測試
- VexFlow 渲染在 SVG 上，和 PixiJS Canvas 是獨立的，不會衝突
- App.tsx 是共用檔案，UI/UX Engineer 改之前先和 Lead 確認
- Designer 不直接改 .tsx，只提供 CSS + 告知需要的 class name
- 完成後各自跑 pnpm test
```

---

## Phase 8：Sheet Music Editor（v1.0.0）

### Stage 1 — Lead 前置作業

```
Lead 需要做：
1. 在 engines/editor/types.ts 定義：
   - EditableNote { id, midi, time, duration, velocity, trackIndex }
   - EditorTool = 'select' | 'draw' | 'erase'
   - EditorCommand (for Undo/Redo) { execute(), undo(), description }
2. 建立空目錄：
   - src/renderer/src/engines/editor/
   - src/renderer/src/features/editor/
3. git commit "phase 8: scaffold editor types and directories"
```

### Stage 2 — Agent Team Prompt

```
建立一個 agent team 來實作 Phase 8 Sheet Music Editor（Piano Roll 編輯器）。

專案背景：
Rexiano — 開源跨平台鋼琴練習軟體。
框架：Electron 33 + React 19 + TypeScript 5.9 + Tailwind 4 + PixiJS 8
狀態管理：Zustand 5
測試：Vitest 4

已完成：Phase 1-7（完整的播放器 + 練習模式 + 五線譜顯示）

Phase 8 目標：Piano Roll 編輯器——點擊新增 / 拖曳移動 / 刪除音符 / Undo-Redo / MIDI 匯出。

設計規格（來自 DESIGN.md）：
MVP 功能：
- Piano Roll 格線 Canvas（PixiJS 或獨立 Canvas）
- 點擊新增音符、拖曳移動/調整長度、Delete 刪除
- 格線吸附 (snap to grid)
- 基本屬性編輯（velocity, duration）
- Undo / Redo（Command Pattern）
- 匯出 .mid

進階：
- 多軌、複製貼上、量化、MusicXML

Store 設計（useEditorStore）：
- notes: EditableNote[]
- selectedNotes: Set<string>
- tool: 'select' | 'draw' | 'erase'
- gridSnap: number (tick)
- undoStack / redoStack
- addNote / deleteNote / moveNote / resizeNote
- exportMidi() → Uint8Array

團隊（4 人）：

Teammate 1 — Engine Engineer（編輯邏輯引擎）：
  身份：精通 Command Pattern 和狀態管理的 TypeScript 工程師。
  任務：
  1. 實作 engines/editor/UndoManager.ts — Command Pattern
     - interface EditorCommand { execute(), undo(), description }
     - class UndoManager { execute(cmd), undo(), redo(), canUndo, canRedo, clear() }
     - 維護 undoStack, redoStack（限制最大深度，如 100）
     - 執行新 command 時清空 redoStack
  2. 實作 engines/editor/NoteOperations.ts — CRUD 操作
     - AddNoteCommand: 新增音符到 notes[]
     - DeleteNoteCommand: 刪除選中音符
     - MoveNoteCommand: 批次移動音符（改 midi + time）
     - ResizeNoteCommand: 批次調整音符長度
     - ChangeVelocityCommand: 批次改力度
     - 每個 command 都封裝 execute() + undo()
  3. 實作 engines/editor/GridSnap.ts
     - 將自由拖曳的位置 snap 到最近的格線
     - 支援不同精度（whole, half, quarter, eighth, sixteenth）
     - pixelToTime(x, gridSnap, pixelsPerBeat)
     - pixelToMidi(y, noteHeight)
  4. 實作 engines/editor/MidiExporter.ts
     - 將 EditableNote[] 轉為標準 MIDI binary
     - 使用 @tonejs/midi 的 Midi class 反向建構
     - exportToMidi(notes, tempo, timeSignature) → Uint8Array
  5. 撰寫引擎測試
  只改：engines/editor/* 及 .test.ts

Teammate 2 — UI/UX Engineer（編輯器 UI）：
  身份：React + Canvas 互動工程師。
  任務：
  1. 新增 stores/useEditorStore.ts
     - notes, selectedNotes, tool, gridSnap
     - 整合 UndoManager
     - CRUD actions（內部呼叫 NoteOperations + UndoManager）
     - exportMidi()
  2. 新增 features/editor/PianoRollEditor.tsx — 核心編輯 Canvas
     - 可選用 PixiJS（複用現有依賴）或 HTML Canvas
     - 橫軸 = 時間，縱軸 = MIDI 音高（0-127）
     - 格線背景（依 gridSnap 精度）
     - 左側 piano key label（和 PianoKeyboard 映射一致）
     - 音符矩形（x = time, y = midi, width = duration, height = 1 note）
     - 互動：
       - Select 模式：點擊選取、Shift+Click 多選、框選
       - Draw 模式：點擊新增音符（snap to grid）
       - Erase 模式：點擊刪除音符
     - 拖曳：移動音符（snap to grid）
     - 邊緣拖曳：調整音符長度
     - Delete 鍵 / Backspace：刪除選中
     - Ctrl+Z / Ctrl+Y：Undo / Redo
  3. 新增 features/editor/EditorToolbar.tsx
     - 三個工具按鈕：Select / Draw / Erase（圖示 + tooltip）
     - Grid snap 精度選擇
     - Undo / Redo 按鈕（disabled 狀態跟隨 canUndo/canRedo）
     - 匯出按鈕
  4. 新增 features/editor/NoteInspector.tsx
     - 右側面板：顯示選中音符的屬性
     - Velocity 滑桿
     - Duration 微調
     - 多選時顯示 "N notes selected"，可批次修改
  5. 撰寫元件測試
  只改：stores/useEditorStore.ts, features/editor/*, 及 .test.ts

Teammate 3 — Frontend Designer（編輯器視覺體驗）：
  身份：前端互動設計師，遵循 CLAUDE.md frontend_aesthetics 指引。
  任務：
  1. Piano Roll 視覺設計
     - 格線顏色和粗細（beat line vs subdivision）
     - 音符矩形的圓角、陰影、hover 效果
     - 選中音符的高亮樣式（border + glow）
     - 黑鍵行的背景色區分（和白鍵行不同深淺）
  2. 工具列和面板的視覺設計
     - 工具按鈕的 active 狀態動效
     - Inspector 面板的滑入動畫
     - 整體排版和間距
  3. 更新 themes/tokens.ts
     - 新增：editorBg, gridLine, gridBeat, noteRect, noteSelected, inspectorBg
  4. 更新 assets/main.css
     - 編輯器相關動效和樣式
     - 工具切換過場
  只改：themes/tokens.ts, assets/main.css
  注意：和 UI/UX Engineer 溝通需要的 CSS class name

Teammate 4 — QA Engineer：
  身份：測試工程師。
  任務：
  1. Review 所有程式碼
  2. Undo/Redo 完整測試：
     - Add → Undo → Redo → 狀態正確
     - Move → Undo → 位置回復
     - 連續 10 次操作 → Undo 10 次 → 全部回復
     - Undo 後做新操作 → Redo stack 清空
  3. Grid snap 精度測試
  4. MIDI 匯出驗證：匯出 → 重新解析 → 音符一致
  5. 鍵盤快捷鍵測試（Ctrl+Z, Delete, Shift+Click）
  6. 確認所有現有測試通過
  只改：*.test.ts

規則：
- Piano Roll Editor 是新的獨立元件，不修改 FallingNotesCanvas
- 可複用 PixiJS（已是依賴），也可用 HTML Canvas
- UndoManager 和 NoteOperations 是純邏輯，不依賴 UI 框架
- Designer 和 UI/UX 協調 class name，不直接改 .tsx
- 完成後各自跑 pnpm test
```

---

## Phase 9：Packaging & Release（v1.0.0）

### Stage 1 — Lead 前置作業

```
Lead 需要做：
1. 確認 electron-builder.yml 設定正確
2. 確認 package.json 的 build scripts 正常
3. 建立 .github/workflows/ 目錄
4. git commit "phase 9: prepare ci/cd structure"
```

### Stage 2 — Agent Team Prompt

```
建立一個 agent team 來實作 Phase 9 Packaging & Release。

專案背景：
Rexiano — 開源跨平台鋼琴練習軟體。
框架：Electron 33, electron-builder 26
現有 build scripts：
- pnpm build:win → Windows .exe/.msi
- pnpm build:mac → macOS .dmg
- pnpm build:linux → Linux .AppImage/.deb/.snap

Phase 9 目標：CI/CD 自動化、自動更新、檔案關聯、安裝體驗優化。

Phase 9 只需要 2 人（Lead + QA），不需要 4 人 team。

團隊（2 人）：

Teammate 1 — Lead（你自己，CI/CD 工程）：
  注意：Lead 就是你，以下是你自己的任務，不是 teammate 的。
  你需要直接實作（不是委派）：
  1. .github/workflows/release.yml
     - Trigger：tag push (v*)
     - Jobs：
       - build-windows：ubuntu-latest, pnpm build:win
       - build-mac：macos-latest, pnpm build:mac
       - build-linux：ubuntu-latest, pnpm build:linux
     - Upload artifacts 到 GitHub Release
  2. 整合 electron-updater
     - pnpm add electron-updater
     - 在 main/index.ts 加入 autoUpdater 邏輯
     - 應用內更新提示（非強制）
  3. 檔案關聯
     - electron-builder.yml 加入 .mid 檔案關聯
     - Windows：NSIS fileAssociation
     - macOS：Info.plist UTI
     - Linux：MIME type

Teammate 1 — QA Engineer：
  身份：測試工程師 + Release 驗證。
  任務：
  1. 驗證各平台打包
     - pnpm build:win / build:mac / build:linux 能成功
     - 檢查產出的安裝檔大小合理
  2. 驗證 electron-updater 設定
     - package.json 的 publish 設定正確
     - autoUpdater 事件處理（checking, available, downloaded, error）
  3. 驗證檔案關聯設定
     - electron-builder.yml 的 fileAssociations 語法正確
  4. 最終回歸測試
     - 跑完整測試 pnpm test
     - 跑 TypeScript check pnpm typecheck
     - 手動 checklist：載入 MIDI → 播放 → MIDI 連接 → 練習模式 → 五線譜 → 編輯器
  5. 檢查安全性
     - CSP headers 正確
     - 無敏感資訊洩漏（no API keys, no credentials in build output）
  6. 檢查 README 是否需要更新
     - 安裝指南
     - Windows BLE MIDI 說明
     - 功能截圖
  只改：*.test.ts, README.md（若有更新）

規則：
- 不改任何功能程式碼，只加 CI/CD 和打包設定
- 不強制 code signing（初期可跳過，README 說明 SmartScreen/Gatekeeper 處理）
- 完成後確認 pnpm build 成功
```

---

## 補充：Code Review Team Prompt（任何 Phase 後可用）

```
建立一個 agent team 來 review 最近完成的 Phase N 程式碼。

三位 reviewer 平行工作，唯讀不改任何檔案。

Teammate 1 — Security Reviewer：
  檢查範圍：
  - IPC 通訊安全（是否有 shell injection, path traversal）
  - XSS 防護（React 的 dangerouslySetInnerHTML 是否被濫用）
  - CSP 設定是否正確
  - MIDI 輸入是否有惡意資料防護
  - 依賴是否有已知漏洞（npm audit）
  產出：安全性報告（嚴重度分級 + 修復建議）

Teammate 2 — Performance Reviewer：
  檢查範圍：
  - 記憶體洩漏（EventListener 未移除, PixiJS sprite 未歸還 pool）
  - 不必要的 React re-render（缺少 memo/useMemo/useCallback）
  - GC 壓力（大量短命物件, 頻繁 Map/Set 操作）
  - Web Audio 節點洩漏（BufferSourceNode 未 disconnect）
  - Bundle 大小（不必要的大型依賴）
  產出：效能報告（瓶頸分析 + 優化建議 + 預估影響）

Teammate 3 — Architecture Reviewer：
  檢查範圍：
  - 模組邊界是否清晰（engine 不依賴 React, store 不依賴 engine 內部）
  - 依賴方向是否正確（上層依賴下層, 不反向）
  - 介面是否穩定（public API 是否過度暴露實作細節）
  - 可測試性（是否有難以 mock 的硬依賴）
  - 是否遵循 DESIGN.md 的架構設計
  - 命名一致性和程式碼風格
  產出：架構報告（違規項目 + 重構建議 + 技術債評估）

三位 reviewer 完成後把報告發給 Lead。
Lead 彙整成統一的 action items 清單，按嚴重度排序。
```

---

## 補充：Debug Team Prompt（遇到跨模組 bug 時）

```
建立一個 agent team 來偵錯以下問題：
[在此描述 bug 症狀]

Teammate 1 — Root Cause Analyst：
  職責：從症狀出發，追蹤到根本原因
  方法：
  - 讀取相關 source code
  - 分析資料流（store → engine → renderer）
  - 建立假說 → 驗證/排除
  - 不改任何程式碼，只分析
  產出：根本原因分析報告 + 修復建議

Teammate 2 — Fix Implementer：
  職責：等 Root Cause Analyst 的結論，然後實作修復
  方法：
  - 閱讀分析報告
  - 實作最小修復（不過度重構）
  - 撰寫回歸測試
  依賴：等 Teammate 1 完成分析

Teammate 3 — Regression Tester：
  職責：確認修復有效且無副作用
  方法：
  - 跑完整測試
  - 手動驗證 bug 不再發生
  - 檢查相關模組有無被影響
  依賴：等 Teammate 2 完成修復
```
