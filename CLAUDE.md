# Rexiano — Claude Code 開發指引

## 必讀文件

開發前請先閱讀以下文件，了解專案全貌與當前進度：

- **[docs/DESIGN.md](docs/DESIGN.md)** — 系統設計文件（Phase 1~9 完整架構、資料模型、技術決策）
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — 開發路線圖與任務追蹤（checkbox 清單，標示已完成 / 未完成）
- **[docs/init.md](docs/init.md)** — 原始需求文件（六大核心功能）

開發任何新功能前，先確認該功能在 DESIGN.md 中的 Phase 定義與架構設計，並在完成後更新 ROADMAP.md 的 checkbox。

## 技術堆疊速查

- **框架**: Electron 33 + React 19 + TypeScript 5.9
- **建置**: electron-vite 5 + Vite 7 + Tailwind CSS 4
- **渲染**: PixiJS 8（下落音符）、CSS（鍵盤 / UI）
- **狀態**: Zustand 5（songStore / playbackStore / themeStore）
- **測試**: Vitest 4
- **套件管理**: pnpm

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

★ Insight ─────────────────────────────────────

WSL2 + Electron 開發的兩個坑：

VS Code 的終端會設定 ELECTRON_RUN_AS_NODE=1（因為 VS Code 本身就是 Electron 應用），這讓子程序的 Electron 以 Node.js 模式運行。必須 unset 它。
WSL2 不支援 Chromium sandbox（seccomp-bpf），需要 NO_SANDBOX=1。GPU 也會 fallback 到軟體渲染。
─────────────────────────────────────────────────

為什麼傳 number[] 而不是 Uint8Array：Electron 的 IPC 使用 structured clone 序列化資料，Uint8Array 在跨 context 傳遞時可能會遺失型別資訊。用 number[] 更安全，renderer 端再轉回 Uint8Array 即可。

## 開發慣例

- PixiJS 透過 `store.getState()` 直接讀取 Zustand（非 React hook），避免 re-render
- 主題色統一透過 CSS Custom Properties `var(--color-*)` 引用，定義在 `src/renderer/src/themes/tokens.ts`
- 字型使用 @fontsource 離線打包（Nunito / DM Sans / JetBrains Mono），不依賴 CDN
- 測試檔案放在對應模組旁邊（`*.test.ts`），使用 Vitest

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
- **Electron MIDI 權限**：在 main process 中透過 `session.setPermissionRequestHandler` 自動核准 `midi` 權限請求（`src/main/ipc/midiDeviceHandlers.ts`）

### 測試注意事項

- Web MIDI API 的 `MIDIInput.onmidimessage` 型別包含 `this: MIDIInput` 約束，測試中需使用 helper 函式 cast 掉此約束（見 `MidiInputParser.test.ts` 中的 `getHandler()`）
- Mock `MIDIInput` 使用 `as unknown as MIDIInput` 型別斷言