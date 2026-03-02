# Squad Plugin — 自主進化特戰小隊設計文件

> Date: 2026-02-28
> Status: Approved
> Author: Claude (參謀總長) + User (總統)

## 1. Overview

### 定位

Squad 是一個 Claude Code Plugin，在官方 Agent Teams 原語之上疊加自主專案管理能力。使用者給定任務目標，參謀總長（主 Claude session）自行偵察、規劃、編組、執行、驗收、反思，並在過程中持續進化。

### 比喻

```
總統（使用者）── 下達任務目標
參謀總長（主 Claude session + squad skills）── 領隊，負責全生命週期
隊員（動態鍛造的 teammates）── 各有量身打造的專業 persona
```

### 核心哲學

1. **不重造原語** — 直接使用官方 TeamCreate / Task / SendMessage / task list / hooks
2. **元能力框架** — Plugin 不提供角色模板，而是教會參謀總長「如何造角色」「如何造工具」「如何從經驗學習」
3. **漸進式信任** — 閘門可配置，從每步確認到全自動
4. **專案無關** — PM 流程不綁定特定專案，透過 CLAUDE.md 吸收專案慣例
5. **持續進化** — 每次任務後反思，知識庫越用越強

---

## 2. 指揮鏈

```
總統（使用者）
  │  下達任務目標
  ▼
參謀總長（主 Claude session = Agent Teams lead）
  │  ── RECON：偵察 codebase
  │  ── PLAN：擬定作戰計畫 + 鍛造角色
  │  ── 向總統報批（gate）
  │  ── EXECUTE：spawn 隊員、分配任務、監控
  │  ── VERIFY：收攏結果、驗證
  │  ── DEBRIEF：交付報告
  │  ── RETRO：反思進化
  │
  ├──▶ 隊員 Alpha（動態鍛造的專家 A）
  ├──▶ 隊員 Bravo（動態鍛造的專家 B）
  ├──▶ 隊員 Charlie（動態鍛造的專家 C）
  └──▶ ...
```

**為什麼參謀總長 = team lead？**

- 官方限制：只有 team lead 能 spawn teammates（禁止巢狀團隊）
- 優勢：參謀總長直接跟使用者對話，不需轉達
- 優勢：參謀總長能讀使用者的對話歷史，理解意圖

---

## 3. 工作流 Pipeline

### 六階段流程

```
 ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 │  RECON   │───▶│  PLAN    │───▶│ EXECUTE  │───▶│ VERIFY   │───▶│ DEBRIEF  │───▶│  RETRO   │
 │  偵察    │    │  作戰計畫 │    │  執行    │    │  驗收    │    │  總結報告 │    │  反思進化 │
 └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
       │              │  ▲            │               │                               │
       │          gate│  │fix         │           gate│                               │
       │              ▼  │            │               ▼                               ▼
       │         [確認]   │       [即時回報]      [確認]                         知識庫 + 能力升級
```

### 各階段職責

| 階段        | 誰做                     | 做什麼                                             | 產出             |
| ----------- | ------------------------ | -------------------------------------------------- | ---------------- |
| **RECON**   | 參謀總長                 | 讀 codebase、CLAUDE.md、DESIGN.md、git log、知識庫 | 內部情報         |
| **PLAN**    | 參謀總長                 | 分解任務、鍛造角色 persona、規劃依賴與並行策略     | 作戰計畫（呈報） |
| **EXECUTE** | 參謀總長 + 隊員          | spawn 隊員、分配任務、隊員在 worktree 中作業       | 程式碼變更       |
| **VERIFY**  | 參謀總長（或指派驗證員） | lint + typecheck + test、code review、完整性確認   | 驗證報告         |
| **DEBRIEF** | 參謀總長                 | 彙整成果、產出結構化報告、更新 ROADMAP             | 任務報告檔       |
| **RETRO**   | 參謀總長                 | 反思效率/角色/工具/流程，更新知識庫，建立新工具    | 知識庫更新       |

### 閘門配置

```yaml
gates:
  supervised: # 每步都確認
    after_plan: true
    after_execute: true
    after_verify: true

  standard: # 只在計畫和驗收時確認（預設）
    after_plan: true
    after_execute: false
    after_verify: true

  autonomous: # 全自動，只交最終報告
    after_plan: false
    after_execute: false
    after_verify: false
```

---

## 4. 三層自主能力

### 4.1 動態角色鍛造（Role Forging）

不預建角色模板。參謀總長在 PLAN 階段根據任務現場設計每個隊員的 persona。

**鍛造流程：**

1. 分析任務需要什麼專業能力
2. 查閱知識庫中過去成功的角色設計（role-patterns.md）
3. 為每個隊員量身打造 system prompt，包含：
   - 專業身份與職責邊界
   - 該任務的特定背景知識
   - 作業規範與禁止事項
   - 與其他隊員的協作介面
4. 透過 Task tool 的 `prompt` 參數注入

**範例：** 任務「為 Rexiano 加入 MIDI 鍵盤視覺回饋」

```
隊員 Alpha — PixiJS 視覺特效專家
「你專精 PixiJS 8 的 particle 和 shader 效果。你的任務是在
 NoteRenderer 中加入按鍵命中時的視覺回饋。必須遵循 engines/
 層的純邏輯慣例，不引入 React 依賴。效能預算：< 2ms/frame。
 完成後通知 lead 並說明特效方案和效能測量結果。」

隊員 Bravo — Zustand 狀態橋接專家
「你專精 Zustand 5 和 React 19 的狀態管理。你的任務是擴展
 useMidiDeviceStore 以支援 activeKeys 狀態，建立從
 MidiInputParser callback 到 store 的橋接。遵循 callback
 pattern（非 EventEmitter）。完成後通知 lead。」
```

### 4.2 自我工具鍛造（Tool Forging）

隊伍在執行中發現缺少工具時，自己建造：

**即時生效：**

- Bash 腳本 → `.claude/squad/tools/*.sh`
- 知識文件 → `.claude/squad/knowledge/*.md`
- 程式碼模組 → 專案內可直接 import 的 utils

**下次任務生效：**

- 新 Skill → `skills/*/SKILL.md`
- Hook 更新 → `hooks/hooks.json`

**範例：** 隊伍發現每次都要手動檢查 DESIGN.md 合規性 →

1. 即時：寫 `check-design-compliance.sh`，本次任務就能用
2. 任務後：提升為正式 skill `design-compliance/SKILL.md`

### 4.3 進化迴圈（Evolution Loop）

```
RETRO 階段
  │
  ├── 效率反思：哪些任務花了預期以上的時間？
  ├── 角色反思：哪個 persona 設計特別有效？記錄為 pattern
  ├── 工具反思：有沒有反覆手動做的事情應該自動化？
  ├── 流程反思：閘門/粒度/並行策略是否恰當？
  │
  ├──▶ 寫入 knowledge/ 對應檔案
  ├──▶ 建立新 skill/tool（如果需要）
  └──▶ 更新 metrics.md（自我評估）
```

知識庫在下次 RECON 階段被讀取，形成持續進化的閉環。

---

## 5. 回報系統

三管齊下，各服務不同場景：

### 5.1 即時戰況（對話內）

- 階段轉換時 → 「PLAN 完成，進入 EXECUTE」
- 隊員完成任務時 → 「Alpha 完成 task #3」
- 遇到阻塞時 → 「Bravo 遇到型別錯誤，正在排除」
- 觸發機制：SendMessage → Lead → 輸出到使用者對話

### 5.2 Task List 追蹤

- 官方 Agent Teams 共享 task list
- 顯示所有任務狀態、誰在做什麼、哪些 blocked
- 使用者可用 `Ctrl+T` 或 `/squad --status` 查看
- 觸發機制：內建功能，不需額外實作

### 5.3 結構化報告檔

DEBRIEF 階段產出 markdown 報告，固定路徑 `.claude/squad/reports/`：

```markdown
# Mission Report: {任務名稱}

> Date: YYYY-MM-DD | Gate: {level} | Duration: ~N min

## Objective

{原始目標}

## Squad Composition

| Callsign | Role             | Tasks Completed |
| -------- | ---------------- | --------------- |
| Alpha    | {動態鍛造的角色} | #1, #3          |
| Bravo    | {動態鍛造的角色} | #2              |

## Execution Summary

{每個階段的關鍵決策和結果}

## Changes Made

{變更檔案清單}

## Verification

- lint: ✅/❌
- typecheck: ✅/❌
- test: ✅/❌ (N → M tests)

## Lessons Learned

{同步寫入 knowledge/lessons.md}
```

---

## 6. Plugin 結構

```
squad/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   └── squad.md                     ← /squad 入口 command
├── agents/                          ← 空目錄（角色在任務中動態鍛造）
├── skills/
│   ├── mission-planning/            ← 教「如何分析任務 + 分解 + 編組」
│   │   └── SKILL.md
│   ├── role-forging/                ← 教「如何鍛造高品質角色 prompt」
│   │   └── SKILL.md
│   ├── tool-forging/                ← 教「如何辨識工具缺口 + 自建工具」
│   │   └── SKILL.md
│   ├── gate-check/                  ← 閘門判斷邏輯
│   │   └── SKILL.md
│   ├── status-report/               ← 報告產出格式
│   │   └── SKILL.md
│   └── retrospective/               ← 教「如何反思 + 寫入知識庫」
│       └── SKILL.md
├── hooks/
│   └── hooks.json                   ← TaskCompleted / Stop hooks
└── config/
    └── defaults.yaml                ← 預設配置模板
```

### 持久化知識庫（隨使用成長）

```
.claude/squad/
├── config.yaml                      ← 使用者配置
├── knowledge/
│   ├── lessons.md                   ← 累積的經驗教訓
│   ├── role-patterns.md             ← 成功的角色設計模式
│   ├── tool-patterns.md             ← 有效的工具/腳本模式
│   └── project-insights/            ← 按專案累積的洞察
│       └── {project-name}.md
├── tools/                           ← 即時可用的腳本工具
│   └── *.sh
├── reports/                         ← 歷次任務報告
│   └── YYYY-MM-DD-{mission-name}.md
└── metrics.md                       ← 自我評估指標追蹤
```

---

## 7. 啟動介面

### /squad Command

```
/squad "目標描述"                      # 預設 standard gate
/squad "目標描述" --gate autonomous     # 全自動
/squad "目標描述" --gate supervised     # 每步確認
/squad --status                        # 查看當前任務進度
/squad --history                       # 查看歷次任務報告
/squad --knowledge                     # 查看累積的知識庫
```

### 自然語言觸發

除了 `/squad` 命令，也可以用自然語言觸發：

- 「組隊做 X」「派隊伍處理 X」「squad X」
- 「出動」「編組」「assign team」

### 配置檔

`.claude/squad/config.yaml`，首次運行時自動建立：

```yaml
default_gate: standard

reports_dir: .claude/squad/reports
knowledge_dir: .claude/squad/knowledge

evolution:
  retro_enabled: true
  auto_create_tools: true
  auto_create_skills: true

team:
  max_members: 5
  default_model: inherit
  use_worktrees: true

verify_commands:
  - "pnpm lint"
  - "pnpm typecheck"
  - "pnpm test"
```

---

## 8. Hook 設計

```json
{
  "description": "Squad mission lifecycle hooks",
  "hooks": {
    "TaskCompleted": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "一個 squad 任務剛完成。檢查：1) 是否有依賴此任務的下游任務可以解鎖 2) 是否需要向 lead 回報特殊狀況 3) 整體進度百分比。產出簡短狀態更新。"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Squad 任務即將結束。驗證：1) 所有 task 是否已完成或有明確原因未完成 2) 報告檔是否已寫入 .claude/squad/reports/ 3) RETRO 知識是否已更新。如果缺少任何一項，return 'block' 並說明原因。"
          }
        ]
      }
    ]
  }
}
```

---

## 9. 技術約束與已知限制

| 約束                                | 影響                             | 對策                                         |
| ----------------------------------- | -------------------------------- | -------------------------------------------- |
| Teammates 不能 spawn teammates      | 參謀總長必須是 team lead         | 參謀總長 = team lead，直接 spawn 所有隊員    |
| Skills/Agents 在 session 開始時載入 | 新建的 skill 下次才生效          | 區分即時工具（bash 腳本）和延遲工具（skill） |
| Agent Teams 仍為實驗性功能          | 可能有 session resumption 等問題 | 報告檔持久化，即使 session 中斷也保留成果    |
| 無真正定時器                        | 無法「每 10 分鐘回報」           | 用事件驅動（階段轉換、任務完成）代替定時     |
| Split pane 不支援 VS Code terminal  | Windows 使用者受限               | 預設 in-process mode，用 Shift+Down 切換     |
| 每個 session 只能有一個 team        | 不能同時跑兩個 squad             | 設計為序列化任務，一個完成再啟動下一個       |

---

## 10. 未來演進方向

1. **Agent SDK Supervisor** — 如果流程穩定後需要更強程式化控制，可加入 Agent SDK 層做真正的定時報告和狀態機
2. **跨 session 持續任務** — 利用知識庫和報告檔實現「中斷後繼續」
3. **多專案知識共享** — knowledge/ 中的通用模式可跨專案複用
4. **成本追蹤** — 在 metrics.md 中記錄 token 使用量，優化模型分配策略
