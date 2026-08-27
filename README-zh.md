<p align="center">
  <img src="docs/figure/Rexiano_icon.png" alt="Rexiano" width="88">
</p>

<h1 align="center">Rexiano</h1>

<p align="center">
  免費、離線的鋼琴練習 — 下落音符、鋼琴鍵盤與 MIDI。<br>
  一位爸爸為 Rex 打造，並分享給所有學琴的人。
</p>

<p align="center">
  <strong>繁體中文</strong> · <a href="README.md">English</a>
</p>

<p align="center">
  和 <strong>Synthesia</strong> 不同：Rexiano 免費、開源、完全離線，並提供 Watch 與 Wait 練習模式。
</p>

<p align="center">
  <a href="https://github.com/EndeavorYen/Rexiano/releases/latest"><strong>下載 Rexiano 1.4.0</strong></a><br>
  <sub>Windows · macOS · Linux · 目前 app 版本 <code>1.4.0</code></sub>
</p>

<p align="center">
  <img src="docs/assets/marketing/piano-sheet-hero.png" alt="窗邊鋼琴與攤開的樂譜 — Rexiano 氣氛圖，不是產品截圖" width="100%">
</p>

<p align="center"><sub>氣氛照片，不是 app 畫面。真實截圖在下方。</sub></p>

<table>
  <tr>
    <td width="33%" align="center">
      <img src="docs/assets/screenshots/rexiano-library.png" alt="Rexiano 曲庫與內建曲目" width="100%"><br>
      <sub>曲庫：內建曲目與 MIDI 匯入。</sub>
    </td>
    <td width="33%" align="center">
      <img src="docs/assets/screenshots/rexiano-practice.png" alt="Rexiano 下落音符練習畫面" width="100%"><br>
      <sub>練習畫面：下落音符、鍵盤、Watch/Wait 與速度控制。</sub>
    </td>
    <td width="33%" align="center">
      <img src="docs/assets/screenshots/rexiano-split-sheet.png" alt="Rexiano 五線譜與下落音符分割畫面" width="100%"><br>
      <sub>可選分割畫面：五線譜可顯示在下落音符上方。</sub>
    </td>
  </tr>
</table>

## 開始練習

1. 從 [GitHub Releases](https://github.com/EndeavorYen/Rexiano/releases/latest) 下載最新 build。
2. 開啟 Rexiano，選擇內建曲目，或拖入自己的 `.mid` / `.midi` 檔案。
3. 先用 **Watch** 模式聽與看，再切到 **Wait** 模式，讓 Rexiano 等你彈對音符才繼續。
4. 想要即時琴鍵回饋與評分時，連接 USB 或藍牙 MIDI 鍵盤。

只聽音樂與看視覺化不需要外接鍵盤。Wait 模式與評分練習需要 MIDI 輸入。

## 安裝

| 平台    | 下載檔案                                                                  | 備註                                                                                    |
| ------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Windows | `rexiano-x.x.x-setup.exe`、`rexiano-x.x.x-win-x64.zip` 或 portable `.exe` | 若瀏覽器阻擋直接下載 `.exe`，請改用 `.zip`。安裝版會建立捷徑；免安裝版不會。            |
| macOS   | `rexiano-x.x.x-arm64.dmg` 或 `rexiano-x.x.x-x64.dmg`                      | 拖到「應用程式」。首次開啟可用 Control-click > 開啟，或到系統設定的隱私權與安全性允許。 |
| Linux   | `rexiano-x.x.x-x86_64.AppImage` 或 `rexiano-x.x.x-amd64.deb`              | AppImage 免安裝；`.deb` 會整合到 Debian/Ubuntu 應用程式選單。                           |

目前公開 build 尚未簽章/公證，因此 Windows SmartScreen 或 macOS Gatekeeper 第一次啟動時可能要求確認。細節請看[安裝指南](docs/installation.md)與[簽章說明](docs/release-signing.md)。

每個 release 都會附上 `SHA256SUMS.txt` 供 checksum 驗證。

## 特色

| 面向      | Rexiano 幫你做到                                                                       |
| --------- | -------------------------------------------------------------------------------------- |
| 視覺學習  | 60 FPS 下落音符、88 鍵高亮與音名標籤。                                                 |
| 聚焦練習  | Watch 與 Wait 模式，加上速度控制。可選分割畫面讓五線譜顯示在下落音符上方。             |
| MIDI 鍵盤 | USB 與藍牙 MIDI 輸入、熱插拔、自動重連與延音踏板支援。                                 |
| 音色      | 內建 FreePats Upright Piano KW SoundFont，透過 Web Audio 播放，並保留合成器 fallback。 |
| 檔案      | 內建曲庫，也可拖放匯入自己的 MIDI 檔。                                                 |

## 藍牙 MIDI

藍牙 MIDI 是否可直接使用，取決於作業系統如何暴露鍵盤裝置：

| 平台    | 設定方式                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| macOS   | 在系統藍牙設定配對鍵盤，再於 Rexiano 選擇裝置。                                                                  |
| Linux   | 透過 BlueZ/ALSA 配對，確認 MIDI port 出現後再於 Rexiano 選擇。                                                   |
| Windows | 先嘗試 Rexiano 的 Bluetooth 掃描。若已配對但沒有 MIDI input，請使用 MIDIberry 或 KORG BLE-MIDI Driver 作為橋接。 |

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

| 指令               | 用途                                      |
| ------------------ | ----------------------------------------- |
| `pnpm dev`         | 以開發模式啟動 Electron，含 HMR。         |
| `pnpm build`       | 型別檢查並建置正式版 app。                |
| `pnpm lint`        | 執行 ESLint。                             |
| `pnpm typecheck`   | 執行 TypeScript 檢查。                    |
| `pnpm test`        | 執行 Vitest 單元測試。                    |
| `pnpm test:e2e`    | 建置後執行 Playwright Electron E2E 測試。 |
| `pnpm test:visual` | 建置後執行重點 UI 視覺 guard 測試。       |

送出 PR 前請執行：

```bash
pnpm lint && pnpm typecheck && pnpm test
```

更新 README 截圖：

```bash
pnpm build
pnpm exec playwright test -c scripts/playwright.readme-screenshots.config.ts
```

## 專案地圖

```text
src/
  main/                  Electron 主程序與 IPC
  preload/               安全 context bridge
  renderer/src/
    engines/             純邏輯：音頻、下落音符、MIDI、練習
    stores/              Zustand 狀態
    features/            React UI
    themes/              CSS custom property tokens
resources/               SoundFont 檔案與內建 MIDI 曲目
build/                   Electron-builder 資源
```

## 技術堆疊

| 層級     | 技術                                     |
| -------- | ---------------------------------------- |
| 桌面框架 | Electron 39                              |
| UI       | React 19、TypeScript 5.9、Tailwind CSS 4 |
| 渲染     | PixiJS 8 下落音符、VexFlow 5 五線譜      |
| 狀態     | Zustand 5                                |
| MIDI     | Web MIDI API、`@tonejs/midi`             |
| 音頻     | Web Audio API、`soundfont2`              |
| 測試     | Vitest 4、Playwright 1.58                |
| 打包     | electron-builder 26                      |

## 文件

| 目標                   | 繁體中文                                                             | English                                                                        |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 開始使用 Rexiano       | [使用手冊](docs/user-guide.md)                                       | [User Guide](docs/user-guide-en.md)                                            |
| 安裝或排除首次啟動問題 | [安裝指南](docs/installation.md)                                     | [Installation Guide](docs/installation-en.md)                                  |
| 理解架構               | [架構文件](docs/architecture-zh.md)、[系統設計](docs/DESIGN.md)      | [Architecture](docs/architecture.md)、[System Design](docs/DESIGN-en.md)       |
| 追蹤專案工作           | [開發路線圖](docs/ROADMAP.md)                                        | [Roadmap](docs/ROADMAP.md)                                                     |
| 查看發佈政策           | [簽章政策](docs/release-signing.md)、[更新流程](docs/update-flow.md) | [Release Signing](docs/release-signing.md)、[Update Flow](docs/update-flow.md) |

## 貢獻

歡迎任何形式的貢獻。改程式碼前，請先閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)、[架構文件](docs/architecture-zh.md)與[系統設計](docs/DESIGN.md)。

請保持變更小、可測試，並符合既有 engine/store/feature 分層。

## 授權

Rexiano 以 [GNU General Public License v3.0](LICENSE) 釋出。你可以依 GPL-3.0 使用、修改與散佈；若散佈修改版本，需以相同授權提供原始碼。

## 致謝

- 為正在學鋼琴的 Rex 而建，以愛打造。
- 感謝讓 Rexiano 成為可能的所有開源專案。
