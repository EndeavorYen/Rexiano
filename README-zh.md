<p align="center">
  <img src="docs/figure/Rexiano_icon.png" alt="Rexiano" width="88">
</p>

<h1 align="center">Rexiano</h1>

<p align="center">
  免費的網頁鋼琴練習 — 下落音符、五線譜與 MIDI，裝成 App 後可離線使用。<br>
  一位爸爸為 Rex 打造，並分享給所有學琴的人。
</p>

<p align="center">
  <strong>繁體中文</strong> · <a href="README.md">English</a>
</p>

<p align="center">
  和 <strong>Synthesia</strong> 不同：Rexiano 免費、開源、打開瀏覽器就能練，並提供 Watch 與 Wait 練習模式。
</p>

<p align="center">
  <strong>在瀏覽器開啟 Rexiano</strong><br>
  <sub>電腦與平板 · Chrome / Edge 可接 MIDI 鍵盤 · 可安裝成 PWA 離線使用</sub>
</p>

<p align="center">
  <img src="docs/assets/marketing/piano-sheet-hero.png" alt="窗邊鋼琴與攤開的樂譜 — Rexiano 氣氛圖，不是產品截圖" width="100%">
</p>

<p align="center"><sub>氣氛照片，不是 app 畫面。真實截圖在下方。</sub></p>

<table>
  <tr>
    <td width="33%" align="center">
      <img src="docs/assets/screenshots/rexiano-library.png" alt="Rexiano 曲庫與內建曲目" width="100%"><br>
      <sub>曲庫：內建曲目、篩選、收藏與最近檔案。</sub>
    </td>
    <td width="33%" align="center">
      <img src="docs/assets/screenshots/rexiano-practice.png" alt="Rexiano 下落音符練習畫面" width="100%"><br>
      <sub>練習畫面：下落音符、鍵盤回饋、評分與速度控制。</sub>
    </td>
    <td width="33%" align="center">
      <img src="docs/assets/screenshots/rexiano-split-sheet.png" alt="Rexiano 五線譜與下落音符分割畫面" width="100%"><br>
      <sub>分割樂譜：五線譜與下落音符同步顯示。</sub>
    </td>
  </tr>
</table>

## 開始練習

1. 用 Chrome 或 Edge 開啟 Rexiano 網頁版（部署在 Vercel）。
2. 選擇內建曲目，或拖入自己的 `.mid` / `.midi` / `.musicxml` 檔案。匯入的檔案會存在這個瀏覽器裡，之後可從「最近開啟」或曲庫直接重開。
3. 先用 **Watch** 模式聽與看，再切到 **Wait** 模式，讓 Rexiano 等你彈對音符才繼續。
4. 想要即時琴鍵回饋與評分時，連接 USB 或藍牙 MIDI 鍵盤。

只聽音樂與看視覺化不需要外接鍵盤。Wait 模式與評分練習需要 MIDI 輸入。

想離線練琴：在 Chrome / Edge 網址列點「安裝」，Rexiano 會變成獨立 App，內建曲目與音色會先下載好。裝好後也可以直接用 Rexiano 開啟 `.mid` 檔。

## 瀏覽器支援

| 裝置                         | 練習與播放 | MIDI 鍵盤                                |
| ---------------------------- | ---------- | ---------------------------------------- |
| Windows / macOS / Linux 電腦 | ✅         | Chrome、Edge（USB 與藍牙）               |
| Android 平板                 | ✅         | Chrome（USB 與藍牙）                     |
| iPad                         | ✅         | Safari 不支援 Web MIDI，請改用下面的方式 |
| 手機                         | 不支援     | 版面以電腦與平板為主                     |

**iPad 接 MIDI 鍵盤**：iPadOS 上所有瀏覽器（包含 Chrome）都用 Safari 的核心，都沒有 Web MIDI。請到 App Store 安裝內建 Web MIDI 的瀏覽器 App（例如「Web MIDI Browser」），用它開啟 Rexiano 網址即可。

練習紀錄存在瀏覽器裡。換瀏覽器或清除網站資料前，請先在設定的「使用者資料備份」匯出。桌面版（1.6.0）的備份檔也可以在這裡匯入。

## 特色

| 面向      | Rexiano 幫你做到                                                                       |
| --------- | -------------------------------------------------------------------------------------- |
| 視覺學習  | 60 FPS 下落音符、88 鍵高亮、音名標籤，以及左右手分色。                                 |
| 五線譜    | 可切換分割、純五線譜、純下落音符模式，在樂譜與 piano-roll 練習間轉換。                 |
| 聚焦練習  | Watch、Wait、Free 模式，加上速度控制、分手練習、節拍器、預備拍與歷史進度。             |
| MIDI 鍵盤 | USB 與藍牙 MIDI 輸入/輸出、熱插拔、自動重連與延音踏板支援。                            |
| 音色      | 內建 FreePats Upright Piano KW SoundFont，透過 Web Audio 播放，並保留合成器 fallback。 |
| 檔案      | 內建曲庫，也可拖放匯入自己的 MIDI 檔。                                                 |

## 藍牙 MIDI

在 Chrome / Edge 按 MIDI 抽屜裡的「藍牙」按鈕，會跳出瀏覽器原生的配對視窗。若鍵盤已在系統配對且出現在一般 MIDI 裝置列表，也可以直接選它：

| 平台    | 設定方式                                                                                     |
| ------- | -------------------------------------------------------------------------------------------- |
| macOS   | 在「音訊 MIDI 設定」配對鍵盤後，它會出現在一般 MIDI 裝置列表。                               |
| Windows | 先試 Rexiano 的藍牙按鈕。若不行，用 MIDIberry 或 KORG BLE-MIDI Driver 橋接成一般 MIDI 裝置。 |
| Android | 直接用 Rexiano 的藍牙按鈕配對。                                                              |

詳細步驟請看[使用手冊 — 連接 MIDI 鍵盤](docs/user-guide.md#5-連接-midi-鍵盤)。

## 開發

前置需求：[Node.js](https://nodejs.org/) `>=22 <23`、[pnpm](https://pnpm.io/) `>=10 <11` 與 Git。

```bash
git clone https://github.com/EndeavorYen/Rexiano.git
cd Rexiano
pnpm install
pnpm dev
```

常用指令：

| 指令               | 用途                                    |
| ------------------ | --------------------------------------- |
| `pnpm dev`         | 啟動 Vite 開發伺服器，含 HMR。          |
| `pnpm build`       | 型別檢查並建置到 `dist/`（含 PWA）。    |
| `pnpm lint`        | 執行 ESLint。                           |
| `pnpm typecheck`   | 執行 TypeScript 檢查。                  |
| `pnpm test`        | 執行 Vitest 單元測試。                  |
| `pnpm test:e2e`    | 建置後在 Chromium 執行 Playwright E2E。 |
| `pnpm test:visual` | 建置後執行重點 UI 視覺 guard 測試。     |

送出 PR 前請執行：

```bash
pnpm lint && pnpm typecheck && pnpm test
```

更新 README 截圖：

```bash
pnpm exec playwright test -c scripts/playwright.readme-screenshots.config.ts
```

## 部署

在 Vercel 匯入這個 repo 即可，設定都在 `vercel.json`（Vite、pnpm、輸出 `dist/`）。推到 `main` 會自動部署，PR 會有預覽網址。

## 專案地圖

```text
src/
  platform/              網頁 platform 層：靜態資源、IndexedDB、檔案選擇與下載（window.api）
  engines/               純邏輯：音頻、下落音符、MIDI、練習
  stores/                Zustand 狀態
  features/              React UI
  themes/                CSS custom property tokens
  shared/                型別與共用驗證
public/                  SoundFont、內建 MIDI 曲目、PWA 圖示
site/                    GitHub Pages 介紹頁
```

## 技術堆疊

| 層級 | 技術                                        |
| ---- | ------------------------------------------- |
| 建置 | Vite 7、vite-plugin-pwa（Workbox）          |
| UI   | React 19、TypeScript 5.9、Tailwind CSS 4    |
| 渲染 | PixiJS 8 下落音符、VexFlow 5 五線譜         |
| 狀態 | Zustand 5                                   |
| MIDI | Web MIDI API、Web Bluetooth、`@tonejs/midi` |
| 音頻 | Web Audio API、`soundfont2`                 |
| 儲存 | IndexedDB、localStorage                     |
| 測試 | Vitest 4、Playwright                        |
| 部署 | Vercel                                      |

## 文件

| 目標             | 繁體中文                                                        | English                                                                  |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 開始使用 Rexiano | [使用手冊](docs/user-guide.md)                                  | [User Guide](docs/user-guide-en.md)                                      |
| 理解架構         | [架構文件](docs/architecture-zh.md)、[系統設計](docs/DESIGN.md) | [Architecture](docs/architecture.md)、[System Design](docs/DESIGN-en.md) |
| 追蹤專案工作     | [開發路線圖](docs/ROADMAP.md)                                   | [Roadmap](docs/ROADMAP.md)                                               |

## 貢獻

歡迎任何形式的貢獻。改程式碼前，請先閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)、[架構文件](docs/architecture-zh.md)與[系統設計](docs/DESIGN.md)。

請保持變更小、可測試，並符合既有 engine/store/feature 分層。

## 授權

Rexiano 以 [GNU General Public License v3.0](LICENSE) 釋出。你可以依 GPL-3.0 使用、修改與散佈；若散佈修改版本，需以相同授權提供原始碼。

## 致謝

- 為正在學鋼琴的 Rex 而建，以愛打造。
- 感謝讓 Rexiano 成為可能的所有開源專案。
