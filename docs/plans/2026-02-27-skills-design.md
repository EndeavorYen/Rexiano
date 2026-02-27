# Rexiano Skills Design — 開發輔助 Skill 套件

> **日期**: 2026-02-27
> **狀態**: 已核准

---

## 概述

為 Rexiano 專案設計 4 個 Claude Code skill，涵蓋從骨架建立到品質把關的完整開發工作流。

### Skill 清單

| 優先級 | Skill | 用途 |
|--------|-------|------|
| P0 | `code-review` | 深度檔案審查，30 項 Rexiano 專屬 checklist |
| P1 | `scaffold-feature` | 按 DESIGN.md 自動建立 engine/store/feature 骨架 |
| P2 | `test-gen` | 分析模組後產生 Vitest 測試骨架 |
| P3 | `design-check` | 驗證實作是否符合 DESIGN.md |

### 工作流

```
scaffold-feature → (填入邏輯) → test-gen → (填入 assertions)
                                    ↓
                              code-review → design-check → verify
```

---

## Skill #1 — code-review

### 觸發

`/code-review`、"review"、"審查"、"check code quality"

### 輸入

- 無參數：審查 `git diff` 中最近修改的檔案
- 指定路徑：審查指定檔案或目錄

### 審查類別（7 類，~30 項）

1. **架構分層** — engine/store/feature 正確性、無跨層依賴、callback pattern、singleton 模式
2. **型別安全** — 無 implicit any、共用型別在 shared/types.ts、IPC 用 number[]、時間用秒
3. **Store 慣例** — 不可變更新（new Map/Set）、computed values in set()、dispose 清理
4. **測試品質** — 對應 .test.ts 存在、beforeEach 重置、edge case 覆蓋、vi.fn() 正確使用
5. **效能與記憶體** — listener detach、Web Audio disconnect、sprite pool、binary search
6. **文件品質** — 檔案頭部 block comment、JSDoc、inline comment
7. **Electron 特有** — IPC 型別完整、Promise await、MIDI 權限

### 輸出格式

結構化報告表格 + Issues 清單 + Highlights

---

## Skill #2 — scaffold-feature

### 觸發

`/scaffold-feature`、"scaffold"、"建骨架"

### 流程

1. 詢問功能名稱與需要的層（engine/store/feature）
2. 讀取 DESIGN.md 對應描述
3. 產生檔案骨架（class + interface + JSDoc + TODO markers）
4. 產生對應的 .test.ts 骨架
5. 提醒 ROADMAP.md 對應任務位置

### 命名推導

- Engine: `{PascalCase}.ts` + `{PascalCase}Callbacks` interface
- Store: `use{PascalCase}Store.ts`
- Feature: `{PascalCase}.tsx`

---

## Skill #3 — test-gen

### 觸發

`/test-gen`、"generate tests"、"寫測試"

### 流程

1. 讀取目標檔案，分析 public methods、callback interface、state transitions
2. 產生 .test.ts 骨架，包含：
   - Happy path（每個 public method）
   - Edge cases（boundary values）
   - Callback assertions（vi.fn()）
   - State transitions
3. 所有 test body 標記 `// TODO: implement`

### 設計決策

產生骨架而非完整測試 — 確保使用者深思 assertion 邏輯。

---

## Skill #4 — design-check

### 觸發

`/design-check`、"check against design"、"對照設計"

### 檢查項

- 預期檔案是否都存在（DESIGN.md vs Glob）
- Class/Interface 名稱一致性
- Public API 簽名一致性
- 資料模型一致性（shared/types.ts）
- 依賴方向正確性（engine → store → feature）

### 輸出

合規報告 + drift 清單 + 修正建議
