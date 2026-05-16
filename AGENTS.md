@/Users/simon/.codex/RTK.md
@/Users/simon/.codex/CLAUDE_CODE_BOOST.md

# Rexiano Agent Instructions

> **TL;DR** - Rexiano 的 agent 工作以 repo 文件、TDD、小步可回復變更與證據式驗證為預設。功能或 bug 修復先寫失敗測試，再實作最小修正；文件、註解、格式或純設定調整可不先寫測試，但仍需做合理檢查。

## Project Context

- 開發前先讀 `CLAUDE.md` 的必讀文件清單，尤其是 `docs/DESIGN.md`、`docs/ROADMAP.md` 與 `docs/init.md`。
- `docs/ROADMAP.md` 是進度單一真實來源；完成 roadmap 任務時，同步更新對應 checkbox。
- 技術棧：Electron 33、React 19、TypeScript 5.9、electron-vite、Tailwind CSS 4、PixiJS 8、Zustand 5、Vitest 4、Playwright、pnpm。
- 主要驗證命令：`pnpm lint && pnpm typecheck && pnpm test`。UI、視覺或主要流程變更時，再加跑對應 `pnpm test:e2e`、`pnpm test:visual` 或聚焦 Playwright 測試。

## TDD Workflow

每次實作功能或修復 bug，依序完成：

1. **Context**：先閱讀 `CLAUDE.md` 指定的 `docs/DESIGN.md`、`docs/ROADMAP.md` 與相關既有程式碼，確認架構分層與測試慣例。
2. **Red**：先新增或更新最貼近行為的測試，確認它會因目前實作不足而失敗。
3. **Green**：只寫讓測試通過所需的最小實作，遵守既有架構、callback pattern、named exports 與 colocated `*.test.ts` 慣例。
4. **Refactor**：在測試維持通過時整理命名、重複邏輯與邊界條件，不擴張到未要求的功能。
5. **Verify**：先跑聚焦測試，再視變更範圍跑 `pnpm lint && pnpm typecheck && pnpm test`；觸及 UI、視覺回歸或主要流程時，加跑對應的 Playwright / visual script。
6. **Track**：若完成 `docs/ROADMAP.md` 中的任務，更新對應 checkbox，讓 ROADMAP 持續作為進度單一真實來源。

## Test Rules

- 優先使用既有 Vitest / Playwright 測試型態；測試檔放在對應模組旁邊，命名為 `*.test.ts`。
- 引擎層測純邏輯，Store 層測狀態轉換，UI 或 Electron / Web MIDI 行為用最接近現有測試模式的單元、整合或 E2E 測試覆蓋。
- 不要為了通過測試而刪除、放寬或跳過失敗測試；若需求真的改變，需同步調整測試、設計文件或 roadmap。
- 若某個行為暫時無法自動化測試，先說明原因，補上可行的下層測試，並在最後回報手動驗證證據。

## Architecture Rules

- 分層保持清楚：`engines/` 是純邏輯且不依賴 React；`stores/` 用 Zustand 橋接 engine 與 React；`features/` 放 UI 元件；main process IPC 留在 `src/main/ipc/*`。
- PixiJS 直接用 `store.getState()` 讀 Zustand，避免把 React hook 拉進 render loop。
- 新增 engine 或 store 時，沿用既有 callback pattern，不改用 EventEmitter。
- 主題色使用 CSS custom properties `var(--color-*)`，定義集中在 `src/renderer/src/themes/tokens.ts`。
- 字型維持離線打包，使用現有 `@fontsource` 依賴，不新增 CDN 字型。
- IPC 傳遞 binary-like 資料時用 `number[]`，renderer 端再轉回 typed array，避免 Electron structured clone 遺失型別。
- 文件中的流程圖或架構圖使用 Mermaid，不使用 ANSI box-drawing 圖形。

## Domain Guardrails

- Practice mode：`WaitMode` 維持狀態機與 callback pattern；和弦判定使用既有時間窗口邏輯；`practiceManager.ts` 以 module-level 單例管理引擎生命週期。
- MIDI：`MidiDeviceManager` 維持 singleton；`MidiInputParser` 用 `onNoteOn` / `onNoteOff` / `onCC` callback；裝置切換需正確 attach / detach parser。
- Audio：播放時間基準使用 `AudioContext.currentTime`；scheduler 維持 look-ahead 排程；`resources/piano.sf2` 載入失敗時保留合成器 fallback。
- Electron dev：優先用 `pnpm dev`，它已處理 `ELECTRON_RUN_AS_NODE` 與 `NO_SANDBOX`；非 WSL2 情境才考慮 `pnpm dev:sandbox`。

## Operating Defaults

- 優先使用 repo 既有模式與工具，不新增依賴，除非使用者要求或 repo 已明確標準化。
- 保持變更小、可回復、聚焦在使用者要求的行為面；避免順手重構無關區域。
- 寫程式後做 review pass；寫文件後做 cut pass，刪掉重複與空泛句。
- 對完成、修好、通過這類結論要附驗證證據，不只靠直覺或測試應該會過。
