# Rexiano — Claude Code 開發指引

## 必讀文件

開發前請先閱讀以下文件，了解專案全貌與當前進度：

- **[docs/DESIGN.md](docs/DESIGN.md)** — 系統設計文件（Phase 1~9 完整架構、資料模型、技術決策）
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — 開發路線圖與任務追蹤（checkbox 清單，標示已完成 / 未完成）
- **[docs/init.md](docs/init.md)** — 原始需求文件（六大核心功能）

## 開發工作流程（必遵守）

每次開發新功能或修復 bug，遵循以下流程：

1. **開發前**：先查閱 DESIGN.md 中對應 Phase 的架構設計，確認檔案結構、資料模型、API 介面
2. **實作時**：按照 DESIGN.md 定義的架構與慣例實現，不自行發明新模式
3. **完成後**：更新 ROADMAP.md 對應任務的 checkbox（`[ ]` → `[x]`），包含子項目
4. **驗證**：執行 `pnpm lint && pnpm typecheck && pnpm test` 確認無回歸

> **重要**：ROADMAP.md 的 checkbox 是專案進度的單一真實來源，必須保持準確。完成一項就勾一項，不要等到全部做完才更新。

## 當前進度快照

| Phase | 狀態      | 說明                                                                  |
| ----- | --------- | --------------------------------------------------------------------- |
| 1~3   | ✅ 完成   | 專案骨架、下落音符引擎、主題系統                                      |
| 4     | ✅ 完成   | 音頻播放（合成音色 fallback，`resources/piano.sf2` 已存在）           |
| 5     | ✅ 完成   | MIDI 裝置連接（Input/Output/Store/UI）                                |
| 6     | ✅ 完成   | 練習模式（引擎 + Store + UI + 整合：tickerLoop / App.tsx / 視覺回饋） |
| 6.5+  | 🔲 未開始 | 兒童可用性增強、樂譜顯示、打包發佈                                    |

## 技術堆疊速查

- **框架**: Electron 33 + React 19 + TypeScript 5.9
- **建置**: electron-vite 5 + Vite 7 + Tailwind CSS 4
- **渲染**: PixiJS 8（下落音符）、CSS（鍵盤 / UI）
- **狀態**: Zustand 5（6 個 store，見下方列表）
- **測試**: Vitest 4（25 個測試檔案，343 tests）
- **套件管理**: pnpm
- **音頻**: Web Audio API + SoundFont（`resources/piano.sf2`, 6MB）

## 前端美學守則

Make creative, distinctive frontends — never generic "AI slop." Key principles:

- **Typography**: Use expressive fonts (project uses Nunito / DM Sans), not defaults like Inter or Arial
- **Color**: Dominant hues with sharp accents via CSS variables. Draw from IDE themes and cultural aesthetics
- **Motion**: Purposeful animations — one well-orchestrated page load with staggered reveals beats scattered micro-interactions. Prefer CSS-only; use Motion library for React
- **Backgrounds**: Layer gradients, geometric patterns, or contextual effects for atmosphere and depth
- **Identity**: Each design should feel hand-crafted for the context. Push past convergence points (e.g. Space Grotesk) — every generation should feel fresh

## 已知陷阱

- **WSL2 + Electron**：VS Code 終端設定 `ELECTRON_RUN_AS_NODE=1` 會讓 Electron 以 Node 模式運行，須 `unset` 它。WSL2 不支援 Chromium sandbox，需 `NO_SANDBOX=1`
- **IPC 傳 `number[]` 而非 `Uint8Array`**：Electron structured clone 會遺失 `Uint8Array` 型別，renderer 端再轉回即可

## Zustand Store 一覽

| Store                 | 檔案                            | 用途                                                            |
| --------------------- | ------------------------------- | --------------------------------------------------------------- |
| `useSongStore`        | `stores/useSongStore.ts`        | 當前載入的歌曲（ParsedSong）                                    |
| `usePlaybackStore`    | `stores/usePlaybackStore.ts`    | 播放狀態（currentTime, isPlaying, pixelsPerSecond）             |
| `useThemeStore`       | `stores/useThemeStore.ts`       | 主題選擇 + localStorage 持久化                                  |
| `useMidiDeviceStore`  | `stores/useMidiDeviceStore.ts`  | MIDI 裝置連接狀態                                               |
| `useSongLibraryStore` | `stores/useSongLibraryStore.ts` | 曲庫元資料                                                      |
| `usePracticeStore`    | `stores/usePracticeStore.ts`    | 練習模式狀態（mode / speed / loopRange / activeTracks / score） |

## 開發慣例

- PixiJS 透過 `store.getState()` 直接讀取 Zustand（非 React hook），避免 re-render
- 主題色統一透過 CSS Custom Properties `var(--color-*)` 引用，定義在 `src/renderer/src/themes/tokens.ts`
- 字型使用 @fontsource 離線打包（Nunito / DM Sans / JetBrains Mono），不依賴 CDN
- 測試檔案放在對應模組旁邊（`*.test.ts`），使用 Vitest
- **引擎層（`engines/`）為純邏輯，不依賴 React**；Store 層橋接引擎與 React；Features 層為 UI 元件
- 新增 store 或引擎時，遵循現有的 callback pattern（非 EventEmitter）
- **文件中的流程圖 / 架構圖一律使用 Mermaid**（`graph TB` / `flowchart TD` / `stateDiagram-v2`），不使用 ANSI 繪製的 box-drawing 圖形（┌ ─ │ 等）

## Phase-Specific Conventions (Phase 4/5/6)

See **[docs/conventions.md](docs/conventions.md)** for detailed architecture, design decisions, and test notes for Audio Engine (Phase 4), MIDI Device (Phase 5), and Practice Mode (Phase 6).

## Design Context

### Users

- **主要用戶**：Rex（6 歲），正在學鋼琴的小朋友
- **次要用戶**：開源鋼琴愛好者（從初學者到中階學習者）
- **使用情境**：在家用電腦 + MIDI 鍵盤（如 Roland）練琴，需要視覺引導的節奏遊戲式體驗
- **語言**：繁體中文（主要）、英文

### Brand Personality

- **三個關鍵詞**：好玩 · 精準 · 溫暖（Playful · Precise · Warm）
- **語氣**：鼓勵性、友善、像一個耐心的老師（「今天要練什麼呢？」「早安！準備好練琴了嗎？」）
- **視覺識別**：暴龍骨骼 + 鋼琴鍵 + 電路板組成的 "R" 字母 — 結合恐龍的童趣與音樂的精準
- **不是什麼**：不是冰冷的專業工具，不是幼稚的卡通遊戲，不是極簡到無聊

### Aesthetic Direction

- **參考風格**：Synthesia（但更好）— 保留下落音符的清晰感與功能性，但增加視覺個性、溫暖質感和精緻度
- **反面教材**：Generic AI slop（紫色漸層白底、Inter 字體、千篇一律的 SaaS 風格）
- **當前主題系統**：4 個主題（Lavender / Ocean / Peach / Midnight），使用 ~50 個 CSS custom property tokens
- **表面風格**：Glassmorphic surfaces（backdrop-filter blur）、多層陰影、`color-mix()` 透明度混合
- **動效**：環境漂移動畫（ambient drift）、頁面進場（fade-slide-in）、卡片懸停上浮、呼吸光暈
- **字型**：Nunito Variable（display / 標題）、DM Sans Variable（body / 內文）、JetBrains Mono Variable（monospace / 數據）

### Design Principles

1. **清晰優先（Clarity First）**：音符下落、琴鍵高亮、節拍指示必須一目了然 — 6 歲小孩要能看懂
2. **溫暖但不幼稚（Warm, Not Childish）**：鼓勵性的語氣與色彩，但不是卡通風格 — 要讓成人使用者也覺得舒適
3. **主題一致性（Theme Coherence）**：所有 UI 元素通過 `var(--color-*)` tokens 著色，永不硬編碼顏色值
4. **動效有目的（Motion With Purpose）**：每個動畫都服務於 UX 目標（引導注意力、確認操作、建立節奏感），不是裝飾
5. **漸進式複雜度（Progressive Complexity）**：預設介面簡單直覺，進階功能（速度控制、段落循環、評分）在需要時才展開
