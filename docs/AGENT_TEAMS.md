# Agent Team 開發指南 — Rexiano

> 使用 Claude Code Agent Teams 的「工作室」開發模式

---

## 目錄

1. [工作室架構](#1-工作室架構)
2. [環境設定](#2-環境設定)
3. [角色定義](#3-角色定義)
4. [Phase 排班表](#4-phase-排班表)
5. [工作流程 SOP](#5-工作流程-sop)
6. [Phase 4-9 詳細任務分配](#6-phase-4-9-詳細任務分配)
7. [檔案所有權規則](#7-檔案所有權規則)
8. [品質關卡 Hooks](#8-品質關卡-hooks)
9. [操作速查](#9-操作速查)
10. [注意事項與限制](#10-注意事項與限制)
11. [啟動 Prompt 範例集](#11-啟動-prompt-範例集)

---

## 1. 工作室架構

### 為什麼不是 7 人常駐？

Agent Teams 的限制決定了最佳團隊大小是 **3-4 人**：

| 因素         | 7 人                         | 3-4 人    |
| ------------ | ---------------------------- | --------- |
| Token 成本   | ~7.5x                        | ~3.5-4.5x |
| 檔案衝突風險 | 極高                         | 可控      |
| 協調通訊開銷 | 吃掉大量 token               | 精簡      |
| 閒置浪費     | Composer 只在 Phase 4-5 有用 | 按需上場  |
| 穩定性       | 未驗證                       | 推薦範圍  |

### 工作室模式

固定 7 個角色，但 **每個 Phase 只排 3-4 人上場**。
Lead session 自身承擔 Leader + Architect 職責（免費，不佔 teammate 名額）。

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   Lead Session = 你的主 session                      │
│   角色：Leader + Architect                           │
│   職責：規劃、定介面、分配任務、整合、最終驗收          │
│   成本：0（已包含在基礎 session）                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│   │ Engine   │ │ UI/UX    │ │ QA       │  ← 每次   │
│   │ Engineer │ │ Engineer │ │ Engineer │    挑 3-4  │
│   └──────────┘ └──────────┘ └──────────┘    人上場  │
│                                                     │
│   ┌──────────┐ ┌──────────┐                         │
│   │ Composer │ │ Frontend │  ← 有需要時              │
│   │ (MIDI)   │ │ Designer │    替換上場              │
│   └──────────┘ └──────────┘                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 2. 環境設定

### 啟用 Agent Teams

已在 `.claude/settings.local.json` 設定：

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### 顯示模式

| 模式                   | 環境需求     | 設定方式                      |
| ---------------------- | ------------ | ----------------------------- |
| **in-process**（預設） | 任何終端皆可 | 直接使用，`Shift+Down` 切換   |
| **tmux split panes**   | WSL2 + tmux  | `claude --teammate-mode tmux` |

```bash
# 可選：WSL2 split panes
sudo apt install tmux && tmux && claude --teammate-mode tmux
```

---

## 3. 角色定義

### Lead：Leader + Architect（你的主 session）

不佔 teammate 名額，每個 Phase 都在場。

| 職責         | 說明                                        |
| ------------ | ------------------------------------------- |
| 架構決策     | 每個 Phase 開始前定好模組邊界和介面         |
| 介面契約     | 在 `src/shared/types.ts` 預先定義 interface |
| 依賴管理     | 修改 `package.json` 安裝新依賴              |
| 共用檔案修改 | `App.tsx`、`main.css` 等多人會碰的檔案      |
| 任務分配     | 建立 Task List，指定檔案所有權              |
| 整合驗收     | 跑完整測試 + type check，確認無衝突         |
| Commit       | 只有 Lead 能 git commit                     |

### Teammate：Engine Engineer（後端/引擎工程師）

```yaml
身份：資深 TypeScript 工程師，專精非 UI 邏輯
擅長：Web Audio API, WebGL, MIDI protocol, 演算法, 效能優化
負責層：src/renderer/src/engines/*, src/main/ipc/*
工具權限：Read, Edit, Write, Bash, Grep, Glob
限制：不碰 *.tsx 元件、不改 CSS/theme
```

### Teammate：UI/UX Engineer（前端元件工程師）

```yaml
身份：React + Tailwind 前端工程師
擅長：React 19, Zustand, 元件設計, 響應式佈局, 無障礙
負責層：src/renderer/src/features/*, src/renderer/src/stores/*
工具權限：Read, Edit, Write, Bash, Grep, Glob
限制：不碰 engines/ 引擎邏輯、不改 main process
```

### Teammate：QA Engineer（品質保證工程師）

```yaml
身份：測試工程師 + Code Reviewer
擅長：Vitest, 單元測試, 整合測試, 效能 profiling, 安全審查
職責：
- Phase 前期：唯讀 review 架構設計
- Phase 中期：平行撰寫測試（*.test.ts）
- Phase 後期：執行完整測試 + 回報問題
工具權限：Read, Edit, Write, Bash, Grep, Glob
負責檔案：所有 *.test.ts, vitest.config.ts
```

### Teammate：Composer（音訊/MIDI 專家）

```yaml
身份：數位音訊 + MIDI 協定專家
擅長：Web Audio API, SoundFont, MIDI spec, AudioContext 排程, 音訊同步
職責：
- 音訊引擎核心邏輯
- MIDI 裝置通訊
- SoundFont 載入與合成
- 音訊時間同步方案
負責層：engines/audio/*, main/ipc/midiDeviceHandlers.ts
上場時機：Phase 4, Phase 5 only
```

### Teammate：Frontend Designer（視覺/動效設計師）

```yaml
身份：前端視覺設計師，注重美學與動效
擅長：CSS animation, Motion library, 主題系統, 字型排版, 微互動
職責：
- 設計新元件的視覺風格
- 實作動畫與過場效果
- 維護主題系統 (tokens.ts)
- 確保設計語言一致性
負責檔案：themes/tokens.ts, assets/main.css, 動效相關 CSS
上場時機：Phase 6 (Practice visual feedback), Phase 7 (Sheet music UI)
遵循：CLAUDE.md 的 frontend_aesthetics 指引
```

---

## 4. Phase 排班表

每個 Phase 從角色池中選 3-4 人。Lead 永遠在場。

```
         Phase 4    Phase 5    Phase 6    Phase 7    Phase 8    Phase 9
         Audio      MIDI       Practice   Sheet      Editor     Release
         ─────────  ─────────  ─────────  ─────────  ─────────  ─────────
Lead      ★          ★          ★          ★          ★          ★
Engine    ●          ●          ●          ●          ●
UI/UX     ●          ●          ●          ●          ●
QA        ●          ●          ●          ●          ●          ●
Composer  ●          ●
Designer                        ●          ●          ●

上場人數  4人         4人         4人         4人         4人         2人
                                                      (最大)     (只需QA)
```

### 各 Phase 的團隊理由

| Phase          | 排班                           | 為什麼                                                         |
| -------------- | ------------------------------ | -------------------------------------------------------------- |
| **4 Audio**    | Engine + UI/UX + QA + Composer | Composer 負責音訊核心，Engine 做排程器，UI/UX 做控制元件       |
| **5 MIDI**     | Engine + UI/UX + QA + Composer | Composer 處理 MIDI 協定，Engine 做 IPC 層，UI/UX 做裝置選擇 UI |
| **6 Practice** | Engine + UI/UX + QA + Designer | Designer 做計分動效和視覺回饋，Engine 做練習邏輯               |
| **7 Sheet**    | Engine + UI/UX + QA + Designer | Engine 做 MIDI→樂譜量化，Designer 做樂譜美化                   |
| **8 Editor**   | Engine + UI/UX + QA + Designer | Engine 做 undo/redo，UI/UX 做工具列，Designer 做互動體驗       |
| **9 Release**  | QA + Lead                      | 只需 CI/CD 設定和最終驗證，不需寫新功能                        |

---

## 5. 工作流程 SOP

每個 Phase 分三個階段，各階段是一個獨立的 Agent Team session。

### Stage 1：規劃（Lead 獨自作業）

```
不需要 Agent Team，Lead 自己做：

1. 閱讀 docs/DESIGN.md 該 Phase 的設計規格
2. 定義介面契約 → 寫入 src/shared/types.ts
3. 安裝新依賴 → pnpm add xxx
4. 建立空目錄結構
5. 決定檔案所有權分配
6. Commit: "phase N: scaffold and interfaces"
```

### Stage 2：平行開發（啟動 Agent Team）

```
啟動 Agent Team，使用本文件的 Phase prompt 模板：

1. Lead 描述團隊組成 + 任務分配 + 檔案所有權
2. Teammates 平行開發
3. Lead 監控（Ctrl+T / Shift+Down）
4. 中途需要調整 → 直接對 teammate 發訊息
5. 所有 teammate 完成 → Lead 整合驗收
6. Commit: "phase N: implement [feature]"
```

### Stage 3：收尾（Lead + QA）

```
可以新開一個 2 人 team（Lead + QA），或 Lead 獨自做：

1. 跑完整測試 pnpm test
2. 跑 type check pnpm typecheck
3. 人工測試（pnpm dev 啟動應用）
4. 修復整合問題
5. 更新 docs/ROADMAP.md 勾選完成項目
6. Commit: "phase N: finalize and update docs"
```

### 一圖總結

```
  Stage 1          Stage 2              Stage 3
  ┌──────┐    ┌─────────────────┐    ┌──────────┐
  │ Lead │───→│ Lead + 3-4 人   │───→│ Lead+QA  │
  │ 規劃 │    │ 平行開發        │    │ 收尾驗收 │
  │      │    │                 │    │          │
  │ 定介面│    │ Engine ──┐      │    │ 跑測試   │
  │ 裝依賴│    │ UI/UX  ──┼─並行 │    │ 修 bug   │
  │ 建結構│    │ QA     ──┤      │    │ 更新文件 │
  │      │    │ 專家   ──┘      │    │          │
  └──────┘    └─────────────────┘    └──────────┘
   commit 1       commit 2            commit 3
```

---

## 6. Phase 4-9 詳細任務分配

### Phase 4：Audio Playback（v0.2.0）

**上場：Engine + UI/UX + QA + Composer**

| Teammate     | 任務                          | 負責檔案（寫入）                         |
| ------------ | ----------------------------- | ---------------------------------------- |
| **Composer** | SoundFont 載入器              | `engines/audio/SoundFontLoader.ts`       |
|              | Web Audio 合成器              | `engines/audio/AudioSynth.ts`            |
|              | AudioContext 時間管理         | `engines/audio/AudioClock.ts`            |
| **Engine**   | Look-ahead 排程器             | `engines/audio/AudioScheduler.ts`        |
|              | 將 tickerLoop 改接 AudioClock | `engines/fallingNotes/tickerLoop.ts`     |
|              | Audio state store             | `stores/useAudioStore.ts`                |
| **UI/UX**    | 音量控制元件                  | `features/audio/VolumeControl.tsx`       |
|              | TransportBar 整合音量         | `features/fallingNotes/TransportBar.tsx` |
|              | 靜音按鈕                      | `features/audio/MuteButton.tsx`          |
| **QA**       | 音訊引擎單元測試              | `engines/audio/*.test.ts`                |
|              | 排程器時序測試                | `engines/audio/AudioScheduler.test.ts`   |
|              | 整合煙霧測試                  | `features/audio/*.test.ts`               |

**介面契約（Lead 預先定義）：**

```typescript
// src/shared/types.ts
interface IAudioClock {
  getCurrentTime(): number; // 秒
  start(): void;
  stop(): void;
  seekTo(time: number): void;
}

interface IAudioEngine {
  loadSoundFont(url: string): Promise<void>;
  scheduleRegion(notes: ParsedNote[], startTime: number): void;
  setVolume(level: number): void; // 0.0 - 1.0
  setMuted(muted: boolean): void;
  dispose(): void;
}
```

---

### Phase 5：MIDI Device（v0.3.0）

**上場：Engine + UI/UX + QA + Composer**

| Teammate     | 任務                     | 負責檔案（寫入）                           |
| ------------ | ------------------------ | ------------------------------------------ |
| **Composer** | Web MIDI API 封裝        | `engines/midi/MidiDeviceManager.ts`        |
|              | MIDI input 解析          | `engines/midi/MidiInputParser.ts`          |
|              | MIDI output 發送         | `engines/midi/MidiOutputSender.ts`         |
| **Engine**   | Main process IPC handler | `main/ipc/midiDeviceHandlers.ts`           |
|              | Preload bridge 擴充      | `preload/index.ts`                         |
|              | 共用型別擴充             | （Lead 預定義後）只讀                      |
| **UI/UX**    | 裝置選擇 UI              | `features/midiDevice/DeviceSelector.tsx`   |
|              | 連線狀態指示             | `features/midiDevice/ConnectionStatus.tsx` |
|              | MIDI device store        | `stores/useMidiDeviceStore.ts`             |
|              | PianoKeyboard MIDI 高亮  | `features/fallingNotes/PianoKeyboard.tsx`  |
| **QA**       | MIDI 裝置模擬測試        | `engines/midi/*.test.ts`                   |
|              | IPC 通訊測試             | `main/ipc/*.test.ts`                       |
|              | 裝置熱插拔測試           | `features/midiDevice/*.test.ts`            |

---

### Phase 6：Practice Mode（v0.4.0）

**上場：Engine + UI/UX + QA + Designer**

| Teammate     | 任務                 | 負責檔案（寫入）                             |
| ------------ | -------------------- | -------------------------------------------- |
| **Engine**   | Wait Mode 邏輯       | `engines/practice/WaitMode.ts`               |
|              | 計分引擎             | `engines/practice/ScoreCalculator.ts`        |
|              | 變速控制             | `engines/practice/SpeedController.ts`        |
|              | A-B 循環邏輯         | `engines/practice/LoopController.ts`         |
| **UI/UX**    | 練習模式選擇器       | `features/practice/PracticeModeSelector.tsx` |
|              | 計分面板             | `features/practice/ScoreOverlay.tsx`         |
|              | A-B 循環 UI          | `features/practice/ABLoopSelector.tsx`       |
|              | 速度滑桿             | `features/practice/SpeedSlider.tsx`          |
|              | Practice store       | `stores/usePracticeStore.ts`                 |
| **Designer** | 命中閃光效果         | `engines/fallingNotes/NoteRenderer.ts` ※     |
|              | 琴鍵動效             | `features/fallingNotes/PianoKeyboard.tsx` ※  |
|              | Practice mode 主題色 | `themes/tokens.ts`                           |
|              | 分數動畫 CSS         | `assets/main.css`                            |
| **QA**       | 計分演算法測試       | `engines/practice/*.test.ts`                 |
|              | 模式切換測試         | `features/practice/*.test.ts`                |
|              | 變速精確度測試       | `engines/practice/SpeedController.test.ts`   |

> ※ Designer 修改已有檔案時，只加動效相關程式碼，不改核心邏輯。
> 需與 Engine 協調哪些函式暴露動效 hook。

---

### Phase 7：Sheet Music（v0.5.0）

**上場：Engine + UI/UX + QA + Designer**

| Teammate     | 任務                | 負責檔案（寫入）                              |
| ------------ | ------------------- | --------------------------------------------- |
| **Engine**   | MIDI→樂譜量化       | `engines/sheetMusic/MidiToNotation.ts`        |
|              | 拍號/小節線計算     | `engines/sheetMusic/MeasureBuilder.ts`        |
|              | VexFlow 渲染封裝    | `engines/sheetMusic/VexFlowRenderer.ts`       |
| **UI/UX**    | 樂譜顯示元件        | `features/sheetMusic/SheetMusicView.tsx`      |
|              | 三模式切換器        | `features/sheetMusic/DisplayModeSelector.tsx` |
|              | 自動捲動 + 光標同步 | `features/sheetMusic/CursorSync.tsx`          |
|              | App.tsx 模式路由    | （Lead 協調後修改）                           |
| **Designer** | 樂譜視覺風格        | `features/sheetMusic/SheetMusicView.tsx` ※    |
|              | 光標動畫            | `assets/main.css`                             |
|              | 樂譜主題色          | `themes/tokens.ts`                            |
| **QA**       | 量化演算法測試      | `engines/sheetMusic/*.test.ts`                |
|              | 不同拍號 edge case  | `engines/sheetMusic/MeasureBuilder.test.ts`   |
|              | 顯示模式切換測試    | `features/sheetMusic/*.test.ts`               |

> ※ Designer 和 UI/UX 共改 SheetMusicView.tsx 時需要協調：
> UI/UX 先建結構，Designer 後加樣式。不可同時修改。

---

### Phase 8：Sheet Music Editor（v1.0.0）

**上場：Engine + UI/UX + QA + Designer**

| Teammate     | 任務                        | 負責檔案（寫入）                       |
| ------------ | --------------------------- | -------------------------------------- |
| **Engine**   | Undo/Redo 系統              | `engines/editor/UndoManager.ts`        |
|              | Note CRUD 操作              | `engines/editor/NoteOperations.ts`     |
|              | MIDI/MusicXML 匯出          | `engines/editor/ExportManager.ts`      |
| **UI/UX**    | Piano Roll 編輯器           | `features/editor/PianoRollEditor.tsx`  |
|              | 工具列（draw/select/erase） | `features/editor/EditorToolbar.tsx`    |
|              | 音符屬性面板                | `features/editor/NoteInspector.tsx`    |
|              | Editor store                | `stores/useEditorStore.ts`             |
| **Designer** | 編輯器互動體驗              | `features/editor/` 的 CSS/動效         |
|              | 工具切換動畫                | `assets/main.css`                      |
|              | 編輯器主題色                | `themes/tokens.ts`                     |
| **QA**       | Undo/Redo 狀態測試          | `engines/editor/*.test.ts`             |
|              | 匯出格式驗證                | `engines/editor/ExportManager.test.ts` |
|              | 編輯操作 E2E 測試           | `features/editor/*.test.ts`            |

---

### Phase 9：Packaging & Release（v1.0.0）

**上場：QA + Lead（只需 2 人）**

| 角色     | 任務                            |
| -------- | ------------------------------- |
| **Lead** | GitHub Actions CI/CD workflow   |
|          | electron-builder 多平台打包設定 |
|          | Auto-update 設定                |
|          | .mid 檔案關聯                   |
| **QA**   | 各平台打包測試                  |
|          | Auto-update 流程驗證            |
|          | 最終回歸測試                    |

---

## 7. 檔案所有權規則

### 黃金法則

```
 一個檔案只有一個 owner，其他人唯讀
 共用檔案由 Lead 在 Stage 1 預先修改好
 新目錄歸建立它的 teammate 所有

 兩個 teammate 同時修改同一個檔案
 沒定介面就動手
```

### 共用檔案策略

| 檔案                       | 策略                             | Owner         |
| -------------------------- | -------------------------------- | ------------- |
| `src/shared/types.ts`      | Lead 在 Stage 1 定義新 interface | Lead          |
| `src/renderer/src/App.tsx` | Lead 或指定 UI/UX                | Lead          |
| `package.json`             | Lead 安裝依賴                    | Lead          |
| `themes/tokens.ts`         | 指定 Designer（上場時）或 UI/UX  | 單一 Teammate |
| `assets/main.css`          | 指定 Designer（上場時）或 UI/UX  | 單一 Teammate |

### 當 Designer 和 UI/UX 需要改同一個元件

分兩輪執行，不可同時：

```
第一輪：UI/UX 建立元件結構 + 功能邏輯
   ↓ UI/UX 完成並通知
第二輪：Designer 加入視覺樣式 + 動效
```

在 prompt 裡明確寫出依賴關係，Agent Teams 會自動排序。

---

## 8. 品質關卡 Hooks

建議加入 `.claude/settings.local.json`：

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx vitest run --reporter=dot 2>&1 | tail -5"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx tsc --noEmit -p tsconfig.web.json 2>&1 | tail -10"
          }
        ]
      }
    ]
  }
}
```

| Hook            | 觸發時機           | 效果                     |
| --------------- | ------------------ | ------------------------ |
| `TaskCompleted` | 任何 task 標完成時 | 測試不過 = 擋回去修      |
| `Stop`          | Agent 要結束時     | Type check 不過 = 繼續修 |

---

## 9. 操作速查

### 快捷鍵（in-process 模式）

| 按鍵         | 功能                       |
| ------------ | -------------------------- |
| `Shift+Down` | 切換到下一個 Teammate      |
| `Enter`      | 進入該 Teammate 的 session |
| `Escape`     | 中斷 Teammate 當前動作     |
| `Ctrl+T`     | 顯示/隱藏共享 Task List    |

### 常用對 Lead 說的指令

```
顯示目前所有 teammates 的進度
告訴 Composer 改用 Tone.js
等所有 teammates 完成後整合
結束 agent team
```

### 完整工作流程

```
# Stage 1：規劃（Lead 獨自）
1. 讀 docs/DESIGN.md 該 Phase 規格
2. 定義介面 → src/shared/types.ts
3. pnpm add 新依賴
4. 建空目錄
5. git commit "phase N: scaffold"

# Stage 2：開發（Agent Team）
6. 新開 Claude Code session
7. 貼入該 Phase 的啟動 prompt（見第 11 節）
8. Ctrl+T 監控 Task List
9. Shift+Down 查看各 teammate
10. 完成 → Lead 整合驗收
11. git commit "phase N: implement"

# Stage 3：收尾
12. pnpm test && pnpm typecheck
13. pnpm dev 人工測試
14. 修 bug
15. 更新 docs/ROADMAP.md
16. git commit "phase N: finalize"
```

---

## 10. 注意事項與限制

### 技術限制

| 限制                            | 應對                                |
| ------------------------------- | ----------------------------------- |
| 一個 session 只能一個 team      | 每個 Phase Stage 2 是獨立 session   |
| Session resume 不恢復 teammates | 頻繁 commit，Stage 2 盡量一口氣完成 |
| Teammates 不能巢狀生成          | 只有 Lead 能建 team                 |
| 檔案衝突 = 覆蓋                 | 嚴格遵守檔案所有權                  |

### 成本估算

```
Phase 9（2人）：~2.5x token
Phase 4-8（4人）：~4.5x token
```

### 何時不需要 Agent Team

- Bug fix → Lead 獨自修
- 單檔改動 → Lead 獨自改
- 純研究 → 用 subagent (Task tool) 更省
- Phase 9 → Lead + QA 兩人就夠

---

## 11. 啟動 Prompt

所有 Phase 的完整啟動 prompt 已獨立成文件：

**[AGENT_TEAM_PROMPTS.md](./AGENT_TEAM_PROMPTS.md)**

包含：

- Phase 4-9 的 Stage 1（Lead 前置）+ Stage 2（Team prompt）
- 每個 prompt 都精確對齊 DESIGN.md 規格和現有 codebase 狀態
- Code Review Team prompt（任何 Phase 後可用）
- Debug Team prompt（跨模組除錯用）
- 直接複製貼入新 Claude Code session 即可啟動
